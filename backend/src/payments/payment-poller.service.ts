import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import {
  DEAL_STATUS,
  LEDGER_ENTRY_TYPES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
} from '../common/constants';

/**
 * Polls Bakong API every 30 seconds for all deals in PAYMENT_PENDING_VERIFICATION.
 * When Bakong confirms a transaction, auto-verifies the payment and advances the deal.
 *
 * Auto-verification path:
 *   - Seller-created deal  → PAID_ESCROWED
 *   - Buyer-created deal   → PAID_WAITING_SELLER_APPROVAL
 */
@Injectable()
export class PaymentPollerService {
  private readonly logger = new Logger(PaymentPollerService.name);
  private readonly bakongApiBase = 'https://api-bakong.nbc.gov.kh/v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollPendingPayments() {
    const token = this.cfg.get<string>('BAKONG_API_TOKEN');
    if (!token) {
      // Silently skip — Bakong not configured (dev mode)
      return;
    }

    // Find all payments pending verification that have a KHQR MD5 for auto-check
    const pending = await this.prisma.payment.findMany({
      where: {
        adminStatus: 'pending',
        autoVerified: false,
        khqrMd5: { not: null },
        deal: { status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION },
      },
      include: {
        deal: {
          include: { participants: true },
        },
      },
      take: 20, // process at most 20 per cycle to avoid Bakong rate limits
    });

    if (pending.length === 0) return;

    this.logger.debug(`Polling ${pending.length} pending payment(s) against Bakong`);

    for (const payment of pending) {
      try {
        await this.checkAndAutoVerify(payment, token);
      } catch (err) {
        this.logger.error(`Failed to auto-verify payment ${payment.id}`, err);
      }
    }
  }

  private async checkAndAutoVerify(payment: any, token: string) {
    const { confirmed, bakongData } = await this.queryBakong(payment.khqrMd5, token);

    if (!confirmed) return; // Not paid yet — skip, will retry next cycle

    this.logger.log(`Payment ${payment.id} confirmed by Bakong — auto-verifying`);

    const deal = payment.deal;
    const fee = this.feePercent();
    const paidAmount = (bakongData as any)?.data?.amount ?? payment.expectedAmount;
    const feeAmount = +(paidAmount * (fee / 100)).toFixed(2);
    const sellerNet = +(paidAmount - feeAmount).toFixed(2);

    // Determine next status
    const nextStatus = deal.creatorRole === 'seller'
      ? DEAL_STATUS.PAID_ESCROWED
      : DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL;

    // Mark payment verified + advance deal in one transaction
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          adminStatus: 'verified',
          autoVerified: true,
          verifiedAt: new Date(),
          paidAmount: paidAmount,
        },
      }),
      this.prisma.deal.update({
        where: { id: deal.id },
        data: {
          status: nextStatus,
          feeAmount: feeAmount,
          netSellerAmount: sellerNet,
        },
      }),
    ]);

    // Create ledger entries for escrow receipt and fee reservation.
    await this.ledger.append({
      dealId: deal.id,
      entryType: LEDGER_ENTRY_TYPES.ESCROW_RECEIVED,
      amount: paidAmount,
      currency: deal.currency,
      reference: `auto-verified:${payment.id}`,
    });
    await this.ledger.append({
      dealId: deal.id,
      entryType: LEDGER_ENTRY_TYPES.PLATFORM_FEE_RESERVED,
      amount: feeAmount,
      currency: deal.currency,
      reference: `auto-verified:${payment.id}`,
    });

    // Audit log
    await this.audit.record({
      dealId: deal.id,
      actorType: 'system',
      action: 'payment.auto_verified',
      details: {
        payment_id: payment.id,
        paid_amount: paidAmount,
        next_status: nextStatus,
        bakong_confirmed: true,
      },
    });

    // Notify all participants
    const buyer = deal.participants.find((p: any) => p.role === 'buyer');
    const seller = deal.participants.find((p: any) => p.role === 'seller');

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYMENT_VERIFIED,
      messageKey: MESSAGE_KEYS.PAYMENT_VERIFIED,
      recipients: [
        ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
        ...(seller ? [{ channel: 'inapp' as const, ref: seller.id }] : []),
        ...(buyer?.telegramChatId ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }] : []),
        ...(seller?.telegramChatId ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }] : []),
      ],
      payload: { auto_verified: true, next_status: nextStatus },
    });
  }

  private async queryBakong(md5: string, token: string): Promise<{ confirmed: boolean; bakongData: unknown }> {
    const url = `${this.bakongApiBase}/check_transaction_by_md5`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ md5 }),
    });
    const json = (await response.json()) as { responseCode?: number; data?: unknown };
    const confirmed = response.ok && json.responseCode === 0 && !!(json.data);
    return { confirmed, bakongData: json };
  }

  private feePercent(): number {
    return Number(this.cfg.get<string>('PLATFORM_FEE_PERCENT') ?? '2');
  }
}
