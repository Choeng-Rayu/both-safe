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
 * Bakong KHQR auto-verification poller.
 *
 * Why this scans READY_FOR_PAYMENT deals as well as
 * PAYMENT_PENDING_VERIFICATION:
 *
 * In the simplified flow there is no manual "I paid, here's the
 * receipt" step. The buyer just scans the KHQR in their banking app
 * and pays. The deal stays in READY_FOR_PAYMENT until *we* notice
 * Bakong has the transaction. So the poller has to look at every
 * pending payment row whose deal is "waiting for the buyer to pay" —
 * not just rows the user has manually advanced to
 * PAYMENT_PENDING_VERIFICATION.
 *
 * The Bakong API contract used here matches the reference SDK:
 *   POST {BAKONG_API_URL}/check_transaction_by_md5
 *   Authorization: Bearer <BAKONG_API_TOKEN>
 *   Body: { md5 }
 *   Success: response.responseCode === 0  (data contains tx details)
 *   Pending: response.responseCode !== 0  (still unpaid)
 */
@Injectable()
export class PaymentPollerService {
  private readonly logger = new Logger(PaymentPollerService.name);
  private readonly bakongApiBase =
    process.env.BAKONG_API_URL ?? 'https://api-bakong.nbc.gov.kh/v1';
  private readonly userAgent =
    'bothsafe-backend/1.0 (+https://bothsafe.app); bakong-khqr-js-compatible';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
  ) {}

  /**
   * 10-second poll cadence — tight enough that a buyer who paid sees
   * the deal flip to PAID_ESCROWED within a few seconds, loose enough
   * that we stay well under Bakong's rate limits even with dozens of
   * concurrent deals.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollPendingPayments() {
    const token = this.cfg.get<string>('BAKONG_API_TOKEN');
    if (!token) return; // Bakong not configured — skip silently in dev

    const pending = await this.prisma.payment.findMany({
      where: {
        adminStatus: 'pending',
        autoVerified: false,
        khqrMd5: { not: null },
        deal: {
          // Cover both legacy rows (PAYMENT_PENDING_VERIFICATION, set
          // when the buyer uploaded a manual receipt) and the new
          // happy path (READY_FOR_PAYMENT — buyer scans the KHQR and
          // pays from their banking app without touching our UI).
          status: {
            in: [
              DEAL_STATUS.READY_FOR_PAYMENT,
              DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
            ],
          },
        },
      },
      include: { deal: { include: { participants: true } } },
      take: 25,
    });

    if (pending.length === 0) return;

    this.logger.log(
      `Polling ${pending.length} pending KHQR payment(s) against Bakong`,
    );

    for (const payment of pending) {
      try {
        await this.checkAndAutoVerify(payment, token);
      } catch (err) {
        this.logger.error(
          `Failed to auto-verify payment ${payment.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async checkAndAutoVerify(payment: any, token: string) {
    const { confirmed, paidAmount, raw } = await this.queryBakong(
      payment.khqrMd5,
      token,
    );

    if (!confirmed) {
      // Useful in dev to see the poller is alive even when nothing has paid yet.
      this.logger.debug(
        `Bakong: payment ${payment.id} (md5=${payment.khqrMd5}) still unpaid`,
      );
      return;
    }

    const deal = payment.deal;
    const fee = this.feePercent();
    const finalAmount = paidAmount ?? payment.expectedAmount ?? deal.amount ?? 0;
    const feeAmount = +(finalAmount * (fee / 100)).toFixed(2);
    const sellerNet = +(finalAmount - feeAmount).toFixed(2);
    const nextStatus = DEAL_STATUS.PAID_ESCROWED;

    this.logger.log(
      `Bakong CONFIRMED payment ${payment.id} for deal ${deal.publicId} amount=${finalAmount} ${deal.currency} — advancing to ${nextStatus}`,
    );

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          adminStatus: 'verified',
          autoVerified: true,
          verifiedAt: new Date(),
          paidAmount: finalAmount,
        },
      }),
      this.prisma.deal.update({
        where: { id: deal.id },
        data: {
          status: nextStatus,
          feeAmount,
          netSellerAmount: sellerNet,
        },
      }),
    ]);

    if (!(await this.ledger.hasEntry(deal.id, 'ESCROW_RECEIVED'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: LEDGER_ENTRY_TYPES.ESCROW_RECEIVED,
        amount: finalAmount,
        currency: deal.currency,
        reference: `auto-verified:${payment.id}`,
      });
    }
    if (!(await this.ledger.hasEntry(deal.id, 'PLATFORM_FEE_RESERVED'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: LEDGER_ENTRY_TYPES.PLATFORM_FEE_RESERVED,
        amount: feeAmount,
        currency: deal.currency,
        reference: `auto-verified:${payment.id}`,
      });
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'system',
      action: 'payment.auto_verified',
      details: {
        payment_id: payment.id,
        paid_amount: finalAmount,
        next_status: nextStatus,
        bakong_response: raw,
      },
    });

    const buyer = deal.participants.find((p: any) => p.role === 'buyer');
    const seller = deal.participants.find((p: any) => p.role === 'seller');
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYMENT_VERIFIED,
      messageKey: MESSAGE_KEYS.PAYMENT_VERIFIED,
      recipients: [
        ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
        ...(seller ? [{ channel: 'inapp' as const, ref: seller.id }] : []),
        ...(buyer?.telegramChatId
          ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }]
          : []),
        ...(seller?.telegramChatId
          ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }]
          : []),
      ],
      payload: { auto_verified: true, next_status: nextStatus },
    });
  }

  /**
   * Hit the Bakong "check_transaction_by_md5" endpoint. Mirrors the
   * BakongKHQR.checkPayment() reference implementation, including the
   * User-Agent header that some Bakong gateways require.
   */
  private async queryBakong(
    md5: string,
    token: string,
  ): Promise<{
    confirmed: boolean;
    paidAmount: number | null;
    raw: unknown;
  }> {
    const url = `${this.bakongApiBase}/check_transaction_by_md5`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify({ md5 }),
      });
    } catch (err) {
      this.logger.warn(
        `Bakong network error for md5=${md5}: ${(err as Error).message}`,
      );
      return { confirmed: false, paidAmount: null, raw: null };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Bakong HTTP ${response.status} for md5=${md5}: ${body.slice(0, 200)}`,
      );
      return { confirmed: false, paidAmount: null, raw: body };
    }

    const json = (await response.json().catch(() => null)) as {
      responseCode?: number;
      responseMessage?: string;
      data?: { amount?: number; currency?: string } | null;
    } | null;
    if (!json) {
      return { confirmed: false, paidAmount: null, raw: null };
    }

    const confirmed = json.responseCode === 0 && !!json.data;
    const paidAmount =
      typeof json.data?.amount === 'number' ? json.data.amount : null;
    return { confirmed, paidAmount, raw: json };
  }

  private feePercent(): number {
    return Number(this.cfg.get<string>('PLATFORM_FEE_PERCENT') ?? '2');
  }
}
