import {
  Action,
  Command,
  Ctx,
  Hears,
  InjectBot,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { DealsService } from '../deals/deals.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { BotStateService } from './bot-state.service';
import { BotRateLimiterService } from './bot-rate-limiter.service';
import type { BotLang } from './bot.messages';
import { t } from './bot.messages';
import { sanitizeText } from '../common/utils/sanitize';

const MAX_PRODUCT_TITLE_LENGTH = 200;
const MAX_NOTE_LENGTH = 500;
const MAX_AMOUNT = 1_000_000_000;
const MIN_AMOUNT = 1;

/**
 * BotUpdate — main Telegraf update handler.
 * Handles /start, /newdeal, /mydeals, /help, /cancel, /chatid, language buttons,
 * role selection, and free-text message processing for the deal flow.
 */
@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);
  private readonly appBase: string;
  private readonly adminChatIds: string[];

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly cfg: ConfigService,
    private readonly dealsService: DealsService,
    private readonly prisma: PrismaService,
    private readonly stateService: BotStateService,
    private readonly audit: AuditService,
    private readonly rateLimiter: BotRateLimiterService,
  ) {
    this.appBase =
      this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
    const adminIds = this.cfg.get<string>('TELEGRAM_ADMIN_CHAT_IDS') ?? '';
    this.adminChatIds = adminIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ─── /start ────────────────────────────────────────────────────────────────

  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id ?? '');
    const from = ctx.from;
    if (!chatId) return;

    await this.stateService.ensureIdentity(chatId, {
      username: from?.username,
      firstName: from?.first_name,
      lastName: from?.last_name,
    });

    // Detect user's Telegram language preference
    const tgLang = from?.language_code ?? 'en';
    const detectedLang: BotLang = tgLang.startsWith('zh')
      ? 'zh'
      : tgLang.startsWith('km')
        ? 'km'
        : 'en';
    await this.stateService.upsertLanguage(chatId, detectedLang);

    // Audit log: user registration
    await this.audit.record({
      actorType: 'system',
      action: 'bot.user.start',
      details: {
        telegram_chat_id: chatId,
        username: from?.username,
        language: detectedLang,
      },
    });

    await ctx.reply(t('bot.start.title', detectedLang), {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        [
          t('bot.menu.create_deal', detectedLang),
          t('bot.menu.my_deals', detectedLang),
        ],
        [
          t('bot.menu.language', detectedLang),
          t('bot.menu.help', detectedLang),
        ],
      ]).resize(),
    });
  }

  // ─── /newdeal ──────────────────────────────────────────────────────────────

  @Command('newdeal')
  async onNewDeal(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id ?? '');
    if (!chatId) return;

    // Rate limit check
    const rateCheck = await this.rateLimiter.checkDealCreation(chatId);
    if (!rateCheck.allowed) {
      const lang = await this.getLang(chatId);
      await ctx.reply(
        `${t('bot.error.rate_limit_exceeded', lang)}\n\n⏳ ${t('bot.error.retry_after', lang)} ${Math.ceil(rateCheck.retryAfterSeconds! / 60)} min`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const lang = await this.getLang(chatId);
    await this.stateService.startNewDeal(chatId);

    await ctx.reply(t('bot.role.ask', lang), {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        [t('bot.role.seller', lang), t('bot.role.buyer', lang)],
        [t('bot.deal.cancel', lang)],
      ]).resize(),
    });
  }

  // ─── /mydeals ──────────────────────────────────────────────────────────────

  @Command('mydeals')
  async onMyDeals(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id ?? '');
    if (!chatId) return;

    const lang = await this.getLang(chatId);
    await this.handleMyDeals(ctx, chatId, lang);
  }

  // ─── /help ─────────────────────────────────────────────────────────────────

  @Command('help')
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id ?? '');
    const lang = await this.getLang(chatId);
    await ctx.reply(t('bot.help.escrow_explain', lang), {
      parse_mode: 'Markdown',
    });
  }

  // ─── /cancel ───────────────────────────────────────────────────────────────

  @Command('cancel')
  async onCancel(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id ?? '');
    if (!chatId) return;

    const lang = await this.getLang(chatId);
    await this.stateService.clearFlow(chatId);
    await this.showMainMenu(ctx, chatId, lang, t('bot.deal.cancelled', lang));
  }

  // ─── /chatid — dev-only admin tool (T-09) ──────────────────────────────────

  @Command('chatid')
  async onChatId(@Ctx() ctx: Context): Promise<void> {
    const isProduction = this.cfg.get<string>('NODE_ENV') === 'production';
    const chatId = String(ctx.chat?.id ?? '');

    if (isProduction && !this.adminChatIds.includes(chatId)) {
      return; // silently ignore in production for non-admins
    }

    await ctx.reply(`${t('bot.dev.chat_id', 'en')} \`${chatId}\``, {
      parse_mode: 'Markdown',
    });
  }

  // ─── Inline keyboard: language selection ───────────────────────────────────

  @Action('lang:km')
  async onLangKm(@Ctx() ctx: Context): Promise<void> {
    await this.setLanguage(ctx, 'km');
  }

  @Action('lang:en')
  async onLangEn(@Ctx() ctx: Context): Promise<void> {
    await this.setLanguage(ctx, 'en');
  }

  @Action('lang:zh')
  async onLangZh(@Ctx() ctx: Context): Promise<void> {
    await this.setLanguage(ctx, 'zh');
  }

  // ─── Hear menu button text (create deal shortcut) ──────────────────────────

  @Hears(/➕/)
  async onCreateDealMenu(@Ctx() ctx: Context): Promise<void> {
    await this.onNewDeal(ctx);
  }

  @Hears(/📋/)
  async onMyDealsMenu(@Ctx() ctx: Context): Promise<void> {
    await this.onMyDeals(ctx);
  }

  @Hears(/🌐/)
  async onLanguageMenu(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id ?? '');
    const lang = await this.getLang(chatId);
    await ctx.reply(t('bot.language.ask', lang), {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🇰🇭 ខ្មែរ', 'lang:km'),
          Markup.button.callback('🇬🇧 English', 'lang:en'),
          Markup.button.callback('🇨🇳 中文', 'lang:zh'),
        ],
      ]),
    });
  }

  @Hears(/❓/)
  async onHelpMenu(@Ctx() ctx: Context): Promise<void> {
    await this.onHelp(ctx);
  }

  // ─── All other text messages → flow handler ────────────────────────────────

  @On('text')
  async onText(@Ctx() ctx: Context): Promise<void> {
    if (!('text' in ctx.message!)) return;
    const text = (ctx.message as { text: string }).text?.trim() ?? '';
    const chatId = String(ctx.chat?.id ?? '');
    if (!chatId || !text) return;

    // skip commands (already handled above)
    if (text.startsWith('/')) return;

    const lang = await this.getLang(chatId);

    // Command rate limit check
    const cmdRate = await this.rateLimiter.checkCommand(chatId);
    if (!cmdRate.allowed) {
      await ctx.reply(t('bot.error.too_many_requests', lang));
      return;
    }
    await this.rateLimiter.recordCommand(chatId);

    // Deduplicate identical messages within 2 seconds
    const isDup = await this.rateLimiter.isDuplicateMessage(chatId, text);
    if (isDup) {
      this.logger.debug(`Duplicate message ignored from chatId=${chatId}`);
      return;
    }

    // Cancel button text
    if (text.includes('❌') && text.toLowerCase().includes('cancel')) {
      await this.stateService.clearFlow(chatId);
      await this.showMainMenu(ctx, chatId, lang, t('bot.deal.cancelled', lang));
      return;
    }

    const state = await this.stateService.get(chatId);

    if (!state || !state.flow) {
      // no active flow — show main menu hint
      await ctx.reply(t('bot.error.unknown_command', lang), {
        parse_mode: 'Markdown',
      });
      return;
    }

    if (state.flow === 'newdeal') {
      await this.handleNewDealFlow(ctx, chatId, lang, text, state);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async handleNewDealFlow(
    ctx: Context,
    chatId: string,
    lang: BotLang,
    text: string,
    state: Awaited<ReturnType<BotStateService['get']>> & {},
  ): Promise<void> {
    switch (state.step) {
      case 'ask_role': {
        // detect role from text
        const isSellerText =
          text.includes('🏪') ||
          text.toLowerCase().includes('seller') ||
          text.includes('ខ្ញុំជាអ្នកលក់') ||
          text.includes('我是卖家');
        const isBuyerText =
          text.includes('🛒') ||
          text.toLowerCase().includes('buyer') ||
          text.includes('ខ្ញុំជាអ្នកទិញ') ||
          text.includes('我是买家');

        if (!isSellerText && !isBuyerText) {
          await ctx.reply(t('bot.role.ask', lang), {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
              [t('bot.role.seller', lang), t('bot.role.buyer', lang)],
              [t('bot.deal.cancel', lang)],
            ]).resize(),
          });
          return;
        }

        const role = isSellerText ? 'seller' : 'buyer';
        await this.stateService.update(chatId, {
          step: 'ask_title',
          creatorRole: role,
        });
        await ctx.reply(t('bot.deal.ask_title', lang), {
          parse_mode: 'Markdown',
          ...Markup.keyboard([[t('bot.deal.cancel', lang)]]).resize(),
        });
        break;
      }

      case 'ask_title': {
        const sanitized = sanitizeText(text, MAX_PRODUCT_TITLE_LENGTH);
        if (!sanitized || sanitized.length === 0) {
          await ctx.reply(t('bot.error.empty_input', lang));
          return;
        }
        await this.stateService.update(chatId, {
          step: 'ask_price',
          productTitle: sanitized,
        });
        await ctx.reply(t('bot.deal.ask_price', lang), {
          parse_mode: 'Markdown',
          ...Markup.keyboard([[t('bot.deal.cancel', lang)]]).resize(),
        });
        break;
      }

      case 'ask_price': {
        const amount = parseFloat(text.replace(/[,\s$]/g, ''));

        // Check retry count
        let retryCount = state.amountRetryCount ?? 0;

        if (isNaN(amount)) {
          retryCount++;
          if (retryCount >= 3) {
            await this.stateService.clearFlow(chatId);
            await ctx.reply(t('bot.error.too_many_retries', lang));
            return;
          }
          await this.stateService.update(chatId, {
            amountRetryCount: retryCount,
          });
          await ctx.reply(t('bot.error.not_a_number', lang));
          return;
        }

        if (amount <= 0) {
          retryCount++;
          if (retryCount >= 3) {
            await this.stateService.clearFlow(chatId);
            await ctx.reply(t('bot.error.too_many_retries', lang));
            return;
          }
          await this.stateService.update(chatId, {
            amountRetryCount: retryCount,
          });
          await ctx.reply(t('bot.error.invalid_amount', lang));
          return;
        }

        if (amount < MIN_AMOUNT) {
          retryCount++;
          if (retryCount >= 3) {
            await this.stateService.clearFlow(chatId);
            await ctx.reply(t('bot.error.too_many_retries', lang));
            return;
          }
          await this.stateService.update(chatId, {
            amountRetryCount: retryCount,
          });
          await ctx.reply(t('bot.error.amount_too_small', lang));
          return;
        }

        if (amount > MAX_AMOUNT) {
          retryCount++;
          if (retryCount >= 3) {
            await this.stateService.clearFlow(chatId);
            await ctx.reply(t('bot.error.too_many_retries', lang));
            return;
          }
          await this.stateService.update(chatId, {
            amountRetryCount: retryCount,
          });
          await ctx.reply(t('bot.error.amount_too_large', lang));
          return;
        }

        // Valid amount — reset retry count
        await this.stateService.update(chatId, {
          step: 'ask_extra',
          amount: String(amount),
          amountRetryCount: 0,
        });

        const extraKey =
          state.creatorRole === 'seller'
            ? 'bot.deal.ask_type_seller'
            : 'bot.deal.ask_note_buyer';
        await ctx.reply(t(extraKey, lang), {
          parse_mode: 'Markdown',
          ...Markup.keyboard([
            [t('bot.deal.skip', lang)],
            [t('bot.deal.cancel', lang)],
          ]).resize(),
        });
        break;
      }

      case 'ask_extra': {
        // skip button or any text
        const isSkip =
          text.includes('⏭️') ||
          text.toLowerCase() === 'skip' ||
          text === '跳过' ||
          text === 'រំលង';

        if (state.creatorRole === 'seller' && !isSkip) {
          const sanitized = sanitizeText(text, MAX_NOTE_LENGTH);
          await this.stateService.update(chatId, { productType: sanitized });
        } else if (state.creatorRole === 'buyer' && !isSkip) {
          const sanitized = sanitizeText(text, MAX_NOTE_LENGTH);
          await this.stateService.update(chatId, { note: sanitized });
        }

        // reload state after update
        const fresh = await this.stateService.get(chatId);
        await this.createDealFromState(ctx, chatId, lang, fresh!);
        break;
      }

      default:
        await ctx.reply(t('bot.error.session_expired', lang));
        await this.stateService.clearFlow(chatId);
    }
  }

  private async createDealFromState(
    ctx: Context,
    chatId: string,
    lang: BotLang,
    state: NonNullable<Awaited<ReturnType<BotStateService['get']>>>,
  ): Promise<void> {
    await ctx.reply(t('bot.deal.creating', lang));

    try {
      // Ensure the Telegram identity is linked to a BothSafe user so the
      // resulting participant has userId set — this is required for the
      // wallet credit path on release/refund.
      const from = ctx.from;
      const { userId } = await this.stateService.ensureIdentity(chatId, {
        username: from?.username,
        firstName: from?.first_name,
        lastName: from?.last_name,
      });

      const result = await this.dealsService.createDeal(
        {
          source: 'telegram',
          creator_role: state.creatorRole!,
          language: lang,
          telegram_chat_id: chatId,
          product_title: state.productTitle ?? undefined,
          amount: state.amount ? parseFloat(state.amount) : undefined,
          product_type:
            state.creatorRole === 'seller'
              ? (state.productType ?? undefined)
              : undefined,
          product_description:
            state.creatorRole === 'buyer'
              ? (state.note ?? undefined)
              : undefined,
        },
        userId,
      );

      // Record rate limit hit for deal creation
      await this.rateLimiter.recordDealCreation(chatId);

      // Audit log: deal creation via bot
      await this.audit.record({
        dealId: result.public_id,
        actorType: 'participant',
        action: 'bot.deal.created',
        details: {
          telegram_chat_id: chatId,
          creator_role: state.creatorRole,
          source: 'telegram',
        },
      });

      await this.stateService.clearFlow(chatId);

      const publicId = result.public_id;
      const creatorUrl = result.creator_access_url;
      const inviteUrl = result.invite_url;
      const dealRoomUrl = `${this.appBase}/d/${publicId}`;

      // Send success message
      await ctx.reply(t('bot.deal.created', lang), {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          [t('bot.menu.create_deal', lang), t('bot.menu.my_deals', lang)],
          [t('bot.menu.language', lang), t('bot.menu.help', lang)],
        ]).resize(),
      });

      // Send private link (creator only)
      await ctx.reply(
        `${t('bot.link.private_warning', lang)}\n\n${creatorUrl}`,
        { parse_mode: 'Markdown' },
      );

      // Send invite link with share instructions
      const inviteRole = state.creatorRole === 'seller' ? 'buyer' : 'seller';
      await ctx.reply(
        `${t('bot.link.share_this', lang)}\n\n\`${inviteUrl}\`\n\n_(Share this ${inviteRole} invite link)_`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.url(
                t('bot.link.open_deal_room', lang),
                dealRoomUrl,
              ),
            ],
          ]),
        },
      );
    } catch (err) {
      this.logger.error(
        `createDeal failed chatId=${chatId}: ${(err as Error).message}`,
      );
      await this.stateService.clearFlow(chatId);
      await ctx.reply(t('bot.error.unexpected', lang));
    }
  }

  private async handleMyDeals(
    ctx: Context,
    chatId: string,
    lang: BotLang,
  ): Promise<void> {
    try {
      // Fetch deals where user is creator OR participant
      const deals = await this.prisma.deal.findMany({
        where: {
          OR: [
            { createdByTelegramChatId: chatId },
            { participants: { some: { telegramChatId: chatId } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { product: true },
      });

      if (!deals.length) {
        await ctx.reply(t('bot.mydeals.empty', lang), {
          parse_mode: 'Markdown',
        });
        return;
      }

      await ctx.reply(t('bot.mydeals.title', lang), { parse_mode: 'Markdown' });

      for (const deal of deals) {
        const title = deal.product?.title ?? '—';
        const amount = deal.amount != null ? `$${deal.amount.toFixed(2)}` : '—';
        const statusKey = `bot.status.${deal.status}`;
        const statusText = t(statusKey, lang);

        const msg = `📦 *${title}*\n💰 ${amount}\n${statusText}`;
        const dealUrl = `${this.appBase}/d/${deal.publicId}`;

        await ctx.reply(msg, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url(t('bot.link.open_deal_room', lang), dealUrl)],
          ]),
        });
      }
    } catch (err) {
      this.logger.error(
        `mydeals failed chatId=${chatId}: ${(err as Error).message}`,
      );
      await ctx.reply(t('bot.error.unexpected', lang));
    }
  }

  private async setLanguage(ctx: Context, lang: BotLang): Promise<void> {
    const chatId = String(ctx.chat?.id ?? '');
    if (!chatId) return;

    await this.stateService.upsertLanguage(chatId, lang);
    await this.stateService.ensureIdentity(chatId, {
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
    });

    // Also store language in TelegramIdentity
    try {
      await this.prisma.telegramIdentity.update({
        where: { chatId },
        data: { language: lang },
      });
    } catch {
      // ignore if not found
    }

    // Audit log: language change
    await this.audit.record({
      actorType: 'system',
      action: 'bot.language.changed',
      details: { telegram_chat_id: chatId, language: lang },
    });

    if ('answerCbQuery' in ctx) {
      await (ctx as any).answerCbQuery();
    }
    await ctx.reply(t('bot.language.set', lang), {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        [t('bot.menu.create_deal', lang), t('bot.menu.my_deals', lang)],
        [t('bot.menu.language', lang), t('bot.menu.help', lang)],
      ]).resize(),
    });
  }

  private async showMainMenu(
    ctx: Context,
    chatId: string,
    lang: BotLang,
    text?: string,
  ): Promise<void> {
    await ctx.reply(text ?? t('bot.start.title', lang), {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        [t('bot.menu.create_deal', lang), t('bot.menu.my_deals', lang)],
        [t('bot.menu.language', lang), t('bot.menu.help', lang)],
      ]).resize(),
    });
  }

  private async getLang(chatId: string): Promise<BotLang> {
    const row = await this.prisma.botState.findUnique({
      where: { chatId },
      select: { language: true },
    });
    return (row?.language as BotLang) ?? 'en';
  }
}
