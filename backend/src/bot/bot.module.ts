import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { PrismaModule } from '../prisma/prisma.module';
import { DealsModule } from '../deals/deals.module';
import { BotUpdate } from './bot.update';
import { BotStateService } from './bot-state.service';
import { BotTelegramService } from './bot-telegram.service';
import { BOT_NOTIFIER } from '../notifications/bot-notifier.interface';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    DealsModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const token = cfg.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
        const isEnabled = cfg.get<string>('TELEGRAM_BOT_ENABLED') !== 'false' && token.length > 10;
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
    BotUpdate,
    BotStateService,
    BotTelegramService,
    // Provide BotTelegramService under the BOT_NOTIFIER injection token
    // so NotificationService can call it without a circular dependency.
    {
      provide: BOT_NOTIFIER,
      useExisting: BotTelegramService,
    },
  ],
  exports: [BotTelegramService, BotStateService, BOT_NOTIFIER],
})
export class BotModule {}
