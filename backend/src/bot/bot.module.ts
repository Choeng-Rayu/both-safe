import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { PrismaModule } from '../prisma/prisma.module';
import { DealsModule } from '../deals/deals.module';
import { AuditModule } from '../common/services/audit.module';
import { BotUpdate } from './bot.update';
import { BotStateService } from './bot-state.service';
import { BotTelegramService } from './bot-telegram.service';
import { BotRateLimiterService } from './bot-rate-limiter.service';
import { BotWebhookGuard } from './bot-webhook.guard';
import { BotCleanupService } from './bot-cleanup.service';
import { BOT_NOTIFIER } from '../notifications/bot-notifier.interface';

/**
 * Validate bot-specific env vars at startup (Req 35.7-8).
 * The bot can be globally disabled by leaving TELEGRAM_BOT_TOKEN unset or
 * setting TELEGRAM_BOT_ENABLED=false — in that case we skip validation.
 */
@Injectable()
class BotEnvValidationService implements OnModuleInit {
  private readonly logger = new Logger('BotConfigValidation');

  constructor(private readonly cfg: ConfigService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    const enabled = this.cfg.get<string>('TELEGRAM_BOT_ENABLED') !== 'false';
    const token = this.cfg.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    if (!enabled || token.length === 0) {
      this.logger.log(
        'Bot disabled (TELEGRAM_BOT_TOKEN missing or TELEGRAM_BOT_ENABLED=false) — skipping bot env validation',
      );
      return;
    }

    if (token.length < 10 || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN appears invalid (expected "<digits>:<token>" format)',
      );
    }

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const webhookUrl = this.cfg.get<string>('TELEGRAM_WEBHOOK_URL') ?? '';
      const webhookSecret =
        this.cfg.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
      if (!webhookUrl) {
        throw new Error('TELEGRAM_WEBHOOK_URL is required in production');
      }
      if (!webhookUrl.startsWith('https://')) {
        throw new Error('TELEGRAM_WEBHOOK_URL must use HTTPS in production');
      }
      if (!webhookSecret) {
        throw new Error('TELEGRAM_WEBHOOK_SECRET is required in production');
      }
    }

    const ttl = Number(
      this.cfg.get<string>('BOT_CONVERSATION_TIMEOUT_MINUTES') ?? '10',
    );
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error(
        'BOT_CONVERSATION_TIMEOUT_MINUTES must be a positive number',
      );
    }

    const dealsPerHour = Number(
      this.cfg.get<string>('BOT_RATE_LIMIT_DEALS_PER_HOUR') ?? '3',
    );
    const cmdsPerMin = Number(
      this.cfg.get<string>('BOT_RATE_LIMIT_COMMANDS_PER_MINUTE') ?? '10',
    );
    if (!Number.isFinite(dealsPerHour) || dealsPerHour <= 0) {
      throw new Error(
        'BOT_RATE_LIMIT_DEALS_PER_HOUR must be a positive number',
      );
    }
    if (!Number.isFinite(cmdsPerMin) || cmdsPerMin <= 0) {
      throw new Error(
        'BOT_RATE_LIMIT_COMMANDS_PER_MINUTE must be a positive number',
      );
    }

    this.logger.log(
      `Bot config OK — ttl=${ttl}m, deals=${dealsPerHour}/h, commands=${cmdsPerMin}/min`,
    );
  }
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    DealsModule,
    AuditModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const token = cfg.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
        const isEnabled =
          cfg.get<string>('TELEGRAM_BOT_ENABLED') !== 'false' &&
          token.length > 10;
        const webhookUrl = cfg.get<string>('TELEGRAM_WEBHOOK_URL') ?? '';
        const webhookSecret = cfg.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
        const isDev = cfg.get<string>('NODE_ENV') !== 'production';

        // If bot is disabled (no token or explicitly disabled), skip launch entirely
        if (!isEnabled) {
          return {
            token: 'DISABLED:placeholder_token_bot_not_enabled',
            launchOptions: false as unknown as undefined,
          };
        }

        if (isDev || !webhookUrl) {
          // Use long polling in development
          return { token };
        }

        // Use webhook in production
        return {
          token,
          launchOptions: {
            webhook: {
              domain: webhookUrl,
              secretToken: webhookSecret || undefined,
            },
          },
        };
      },
    }),
  ],
  providers: [
    BotEnvValidationService,
    BotUpdate,
    BotStateService,
    BotTelegramService,
    BotRateLimiterService,
    BotWebhookGuard,
    BotCleanupService,
    // Provide BotTelegramService under the BOT_NOTIFIER injection token
    // so NotificationService can call it without a circular dependency.
    {
      provide: BOT_NOTIFIER,
      useExisting: BotTelegramService,
    },
  ],
  exports: [
    BotTelegramService,
    BotStateService,
    BotRateLimiterService,
    BotWebhookGuard,
    BOT_NOTIFIER,
  ],
})
export class BotModule {}
