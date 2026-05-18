import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../common/services/audit.service';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import { NotificationService } from '../notifications/notification.service';
import {
  DEAL_STATUS,
  LEDGER_ENTRY_TYPES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
} from '../common/constants';

type TransferPurpose = 'seller_payout' | 'buyer_refund';

type ProviderResult = {
  success: boolean;
  reference?: string;
  response: unknown;
  failureReason?: string;
};

@Injectable()
export class TransfersService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async payoutSeller(dealId: string, reason = 'buyer_confirmed') {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true },
    });
    if (!deal) throw new BadRequestException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (deal.status !== DEAL_STATUS.RELEASE_PENDING && deal.status !== DEAL_STATUS.DISPUTED) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    const seller = deal.participants.find((p) => p.role === 'seller');
    if (!seller?.payoutKhqr && !seller?.payoutKhqrImage && !(seller?.payoutBankName && seller?.payoutAccountNumber)) {
      throw new BadRequestException({ messageKey: 'transfer.missing_seller_payout' });
    }

    const amount = deal.netSellerAmount ?? deal.amount ?? 0;
    const result = await this.executeTransfer({
      deal,
      purpose: 'seller_payout',
      amount,
      currency: deal.currency,
      destination: {
        payout_khqr: seller.payoutKhqr,
        payout_bank_name: seller.payoutBankName,
        payout_account_name: seller.payoutAccountName,
        payout_account_number: seller.payoutAccountNumber,
      },
      reason,
    });

    await this.prisma.$transaction([
      this.prisma.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.RELEASED },
      }),
    ]);

    if (!(await this.ledger.hasEntry(deal.id, LEDGER_ENTRY_TYPES.SELLER_PAYOUT_SENT))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: LEDGER_ENTRY_TYPES.SELLER_PAYOUT_SENT,
        amount,
        currency: deal.currency,
        reference: result.reference,
      });
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'system',
      action: 'transfer.seller_payout_succeeded',
      details: { reference: result.reference, reason },
    });

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYOUT_RELEASED,
      messageKey: MESSAGE_KEYS.RELEASED,
      recipients: [
        ...deal.participants.map((p) => ({ channel: 'inapp' as const, ref: p.id })),
        ...(seller.telegramChatId ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }] : []),
      ],
      payload: { reference: result.reference },
    });

    return { status: DEAL_STATUS.RELEASED, provider_reference: result.reference };
  }

  async refundBuyer(dealId: string, reason: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true, payments: true },
    });
    if (!deal) throw new BadRequestException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (deal.status !== DEAL_STATUS.DISPUTED && deal.status !== DEAL_STATUS.RELEASE_PENDING) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    const payment = deal.payments.find((p) => p.adminStatus === 'verified');
    if (!payment) throw new BadRequestException({ messageKey: 'transfer.no_verified_payment' });

    const amount = payment.paidAmount ?? deal.amount ?? 0;
    const result = await this.executeTransfer({
      deal,
      purpose: 'buyer_refund',
      amount,
      currency: deal.currency,
      destination: {
        original_payment_id: payment.id,
        buyer_participant_id: buyer?.id,
        buyer_phone: buyer?.phone,
      },
      reason,
    });

    if (!(await this.ledger.hasEntry(deal.id, LEDGER_ENTRY_TYPES.BUYER_REFUND_PENDING))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: LEDGER_ENTRY_TYPES.BUYER_REFUND_PENDING,
        amount,
        currency: deal.currency,
        reference: result.reference,
      });
    }
    if (!(await this.ledger.hasEntry(deal.id, LEDGER_ENTRY_TYPES.BUYER_REFUND_SENT))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: LEDGER_ENTRY_TYPES.BUYER_REFUND_SENT,
        amount,
        currency: deal.currency,
        reference: result.reference,
      });
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.REFUNDED },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'system',
      action: 'transfer.buyer_refund_succeeded',
      details: { reference: result.reference, reason },
    });

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.REFUND_COMPLETED,
      messageKey: MESSAGE_KEYS.REFUNDED,
      recipients: [
        ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
        ...(buyer?.telegramChatId ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }] : []),
      ],
      payload: { reference: result.reference },
    });

    return { status: DEAL_STATUS.REFUNDED, provider_reference: result.reference };
  }

  private async executeTransfer(input: {
    deal: { id: string; publicId: string; currency: string };
    purpose: TransferPurpose;
    amount: number;
    currency: string;
    destination: Record<string, unknown>;
    reason: string;
  }): Promise<ProviderResult> {
    const idempotencyKey = `${input.purpose}:${input.deal.id}`;
    const existing = await this.prisma.transferAttempt.findUnique({
      where: { idempotencyKey },
    });
    if (existing?.status === 'succeeded') {
      return {
        success: true,
        reference: existing.providerReference ?? undefined,
        response: existing.providerResponseJson ? JSON.parse(existing.providerResponseJson) : null,
      };
    }

    const request = {
      type: input.purpose,
      deal_public_id: input.deal.publicId,
      amount: input.amount,
      currency: input.currency,
      destination: input.destination,
      metadata: { deal_id: input.deal.id, reason: input.reason },
    };

    const attempt = await this.prisma.transferAttempt.upsert({
      where: { idempotencyKey },
      update: {
        status: 'pending',
        amount: input.amount,
        currency: input.currency,
        providerRequestJson: JSON.stringify(request),
        failureReason: null,
        attemptCount: { increment: 1 },
      },
      create: {
        dealId: input.deal.id,
        purpose: input.purpose,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey,
        providerRequestJson: JSON.stringify(request),
        attemptCount: 1,
      },
    });

    try {
      const result = await this.callProvider(request, idempotencyKey);
      if (!result.success) {
        await this.markFailed(attempt.id, result.response, result.failureReason ?? 'provider_failed');
        throw new ServiceUnavailableException({
          messageKey: MESSAGE_KEYS.TRANSFER_FAILED,
          details: { reason: result.failureReason ?? 'provider_failed' },
        });
      }

      await this.prisma.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'succeeded',
          providerReference: result.reference ?? null,
          providerResponseJson: JSON.stringify(result.response),
          failureReason: null,
        },
      });

      return result;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const message = (error as Error).message;
      await this.markFailed(attempt.id, { error: message }, message);
      throw new ServiceUnavailableException({
        messageKey: MESSAGE_KEYS.TRANSFER_FAILED,
        details: { reason: message },
      });
    }
  }

  private async callProvider(
    request: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ProviderResult> {
    const baseUrl = this.cfg.get<string>('TRANSFER_API_BASE_URL');
    if (!baseUrl) {
      this.logger.warn(
        `No TRANSFER_API_BASE_URL configured — using MVP manual fallback for ${String(request.type)} deal=${String(request.deal_public_id)}`,
        TransfersService.name,
      );
      const manualRef = `mvp_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        reference: manualRef,
        response: { mvp_fallback: true, note: 'No transfer provider configured. Admin must handle payout manually.' },
      };
    }

    const endpoint = this.cfg.get<string>('TRANSFER_API_ENDPOINT') ?? '/transfers';
    const apiKey = this.cfg.get<string>('TRANSFER_API_KEY') ?? '';
    const apiSecret = this.cfg.get<string>('TRANSFER_API_SECRET') ?? '';
    const url = new URL(endpoint, baseUrl).toString();

    this.logger.log(`Calling transfer provider for ${String(request.type)} deal=${String(request.deal_public_id)}`, TransfersService.name);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(request),
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const status = String(json.status ?? '').toLowerCase();
    const success = response.ok && (json.success === true || ['success', 'succeeded', 'completed'].includes(status));
    const reference = typeof json.reference === 'string'
      ? json.reference
      : typeof json.provider_reference === 'string'
        ? json.provider_reference
        : undefined;

    return {
      success,
      reference,
      response: json,
      failureReason: success ? undefined : String(json.message ?? json.error ?? response.statusText),
    };
  }

  private async markFailed(attemptId: string, response: unknown, reason: string) {
    await this.prisma.transferAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'failed',
        providerResponseJson: JSON.stringify(response),
        failureReason: reason,
      },
    });
  }
}
