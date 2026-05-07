import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import type { Telegraf } from 'telegraf';
import { t, statusLabel, type BotLang } from './bot.messages';
import { PrismaService } from '../prisma/prisma.service';

/**
 * BotTelegramService — sends Telegram messages from backend notification events.
 * Called by NotificationService when channel === 'telegram'.
 * Notification failure MUST NOT roll back deal status updates.
 */
@Injectable()
export class BotTelegramService {
  private readonly logger = new Logger(BotTelegramService.name);
  private readonly appBase: string;

  constructor(
    @Optional() @InjectBot() private readonly bot: Telegraf | null,
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.appBase = this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
  }

  /**
   * Send a notification message to a Telegram chat ID.
   * Looks up the deal to get the deal Room URL and participant language.
   */
  async sendNotification(opts: {
    chatId: string;
    eventKey: string;
    dealPublicId?: string;
    dealId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot not initialised — skipping Telegram notification');
      return;
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
          data: { delivered: true },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Telegram send failed chatId=${opts.chatId} event=${opts.eventKey}: ${(err as Error).message}`,
      );
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
      this.logger.warn('Bot not initialised — skipping sendMessage');
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
      this.logger.warn(`Telegram sendMessage failed chatId=${chatId}: ${(err as Error).message}`);
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
}
