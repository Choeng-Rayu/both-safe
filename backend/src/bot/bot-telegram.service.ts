import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import type { Telegraf } from 'telegraf';
import { t, statusLabel, type BotLang } from './bot.messages';
import { PrismaService } from '../prisma/prisma.service';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
/**
 * BotTelegramService — sends Telegram messages from backend notification events.
 * Called by NotificationService when channel === 'telegram'.
 * Notification failure MUST NOT roll back deal status updates.
 */
@Injectable()
export class BotTelegramService {
  private readonly appBase: string;

  constructor(
    @Optional() @InjectBot() private readonly bot: Telegraf | null,
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
  ) {
    this.appBase = this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
  }

  /**
   * Send a notification message to a Telegram chat ID.
   * Looks up the deal to get the deal Room URL and participant language.
   * Implements retry with exponential backoff and stores failed attempts.
   */
  async sendNotification(opts: {
    chatId: string;
    eventKey: string;
    dealPublicId?: string;
    dealId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot not initialised — skipping Telegram notification', BotTelegramService.name);
      return;
    }

    const MAX_RETRIES = 3;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        await this.sleep(delayMs);
      }

      try {
        const lang = await this.getLang(opts.chatId);
        const msgKey = `bot.notify.${opts.eventKey}`;
        let text = t(msgKey, lang);

        // For admin payout alerts, append seller info to the message
        if (opts.eventKey === 'BUYER_CONFIRMED_PAYOUT_REQUIRED' && opts.payload) {
          const p = opts.payload as Record<string, string | number | null>;
          const lines: string[] = [text, ''];
          lines.push(`📋 *Deal:* \`${String(p['deal_public_id'] ?? '')}\``);
          lines.push(`👤 *Seller:* ${String(p['seller_name'] ?? 'Unknown')}`);
          lines.push(`💰 *Amount:* ${String(p['amount'] ?? '0')} ${String(p['currency'] ?? 'USD')}`);
          if (p['payout_khqr']) lines.push(`📱 *Bakong ID:* \`${String(p['payout_khqr'])}\``);
          if (p['payout_bank']) lines.push(`🏦 *Bank:* ${String(p['payout_bank'])}`);
          if (p['payout_account']) lines.push(`💳 *Account:* \`${String(p['payout_account'])}\``);
          text = lines.join('\n');
        }

        // BOTH_APPROVED (Req 14.3): include payment amount and receiving account
        if (opts.eventKey === 'BOTH_APPROVED' && opts.payload) {
          const p = opts.payload as Record<string, string | number | null>;
          const amount = p['amount'];
          const currency = p['currency'] ?? 'USD';
          const receiver = p['receiver_account_label'] ?? p['receiver_label'];
          const lines = [text];
          if (amount != null) lines.push(`💰 *Amount:* ${String(amount)} ${String(currency)}`);
          if (receiver) lines.push(`🏦 *Pay to:* ${String(receiver)}`);
          text = lines.join('\n');
        }

        // DISPUTE_OPENED (Req 19.3): include dispute reason
        if (opts.eventKey === 'DISPUTE_OPENED' && opts.payload) {
          const p = opts.payload as Record<string, string | number | null>;
          const reason = p['reason'] ?? p['dispute_reason'];
          if (reason) {
            text = `${text}\n📝 *Reason:* ${String(reason)}`;
          }
        }

        // PAYMENT_REJECTED (Req 16.2): include rejection reason if provided
        if (opts.eventKey === 'PAYMENT_REJECTED' && opts.payload) {
          const p = opts.payload as Record<string, string | number | null>;
          const reason = p['rejected_reason'] ?? p['reason'];
          if (reason) {
            text = `${text}\n📝 *Reason:* ${String(reason)}`;
          }
        }

        // SHIPPING_UPLOADED (Req 17.2-3): include tracking + carrier if provided
        if (opts.eventKey === 'SHIPPING_UPLOADED' && opts.payload) {
          const p = opts.payload as Record<string, string | number | null>;
          const lines = [text];
          if (p['delivery_company']) lines.push(`🚚 *Carrier:* ${String(p['delivery_company'])}`);
          if (p['tracking_number']) lines.push(`🔢 *Tracking:* \`${String(p['tracking_number'])}\``);
          text = lines.join('\n');
        }

        // Build inline keyboard — admin payout event gets Admin Panel button, others get Deal Room
        let inlineKeyboard: Array<Array<{ text: string; url: string }>> | undefined;
        if (opts.eventKey === 'BUYER_CONFIRMED_PAYOUT_REQUIRED' && opts.payload?.['admin_url']) {
          inlineKeyboard = [[{ text: '🔐 Open Admin Panel', url: String(opts.payload['admin_url']) }]];
        } else if (opts.dealPublicId) {
          inlineKeyboard = [[{ text: t('bot.link.open_deal_room', lang), url: `${this.appBase}/d/${opts.dealPublicId}` }]];
        }

        await this.bot.telegram.sendMessage(opts.chatId, text, {
          parse_mode: 'Markdown',
          ...(inlineKeyboard && {
            reply_markup: { inline_keyboard: inlineKeyboard },
          }),
        });

        // Mark notification as delivered
        if (opts.dealId) {
          await this.prisma.notification.updateMany({
            where: {
              dealId: opts.dealId,
              channel: 'telegram',
              recipientRef: opts.chatId,
              eventKey: opts.eventKey,
              delivered: false,
            },
            data: { delivered: true, failureReason: null },
          });
        }

        // Success — exit retry loop
        return;
      } catch (err) {
        lastErr = err as Error;
        this.logger.warn(
          `Telegram send attempt ${attempt + 1}/${MAX_RETRIES} failed chatId=${opts.chatId} event=${opts.eventKey}: ${lastErr.message}`,
          BotTelegramService.name,
        );
      }
    }

    // All retries exhausted — store failure for admin review
    this.logger.error(
      `Telegram notification permanently failed chatId=${opts.chatId} event=${opts.eventKey}: ${lastErr?.message}`,
      undefined,
      BotTelegramService.name,
    );

    if (opts.dealId) {
      await this.prisma.notification.updateMany({
        where: {
          dealId: opts.dealId,
          channel: 'telegram',
          recipientRef: opts.chatId,
          eventKey: opts.eventKey,
          delivered: false,
        },
        data: { failureReason: lastErr?.message ?? 'Unknown error' },
      });
    }
  }

  /**
   * Send a plain text message to a chat ID (for deal creation success etc).
   */
  async sendMessage(
    chatId: string,
    text: string,
    opts?: {
      url?: string;
      parseMode?: 'Markdown' | 'HTML';
    },
  ): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot not initialised — skipping sendMessage', BotTelegramService.name);
      return;
    }

    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: opts?.parseMode ?? 'Markdown',
        ...(opts?.url && {
          reply_markup: {
            inline_keyboard: [[{ text: t('bot.link.open_deal_room', 'en'), url: opts.url }]],
          },
        }),
      });
    } catch (err) {
      this.logger.warn(`Telegram sendMessage failed chatId=${chatId}: ${(err as Error).message}`, BotTelegramService.name);
    }
  }

  /**
   * Health check for Telegram Bot API connectivity.
   * Calls getMe to verify the bot token is valid and API is reachable.
   */
  async healthCheck(): Promise<{ status: string; ok: boolean; last_success_at?: string }> {
    if (!this.bot) {
      return { status: 'disabled', ok: true };
    }
    try {
      const me = await this.bot.telegram.getMe();
      return {
        status: 'healthy',
        ok: true,
        last_success_at: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(`Telegram health check failed: ${(err as Error).message}`, BotTelegramService.name);
      return { status: 'unhealthy', ok: false };
    }
  }

  private async getLang(chatId: string): Promise<BotLang> {
    const row = await this.prisma.botState.findUnique({ where: { chatId }, select: { language: true } });
    return (row?.language as BotLang) ?? 'en';
  }

  /** Format deal status line for /mydeals */
  formatDealLine(deal: {
    publicId: string;
    status: string;
    amount: number | null;
    product?: { title: string | null } | null;
  }, lang: BotLang): string {
    const title = deal.product?.title ?? '—';
    const amount = deal.amount != null ? `$${deal.amount.toFixed(2)}` : '—';
    const status = statusLabel(deal.status, lang);
    return `📦 *${title}*\n💰 ${amount} | ${status}\n🆔 \`${deal.publicId}\``;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
