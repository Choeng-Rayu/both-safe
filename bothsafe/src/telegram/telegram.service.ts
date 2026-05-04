import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Bot;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      this.logger.log(
        'Telegram bot disabled because TELEGRAM_BOT_TOKEN is not set',
      );
      return;
    }

    this.bot = new Bot(token);
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        'BothSafe protected checkout is ready. Use the web app to create products, deals, and secured digital delivery links.',
      );
    });
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        'V1 supports deal notifications, payment status alerts, buyer confirmation, and dispute reminders.',
      );
    });

    void this.bot.start({
      onStart: (info) => {
        this.logger.log(`Telegram bot started as @${info.username}`);
      },
    });
  }

  async notifyTelegramId(telegramId: string, message: string) {
    if (!this.bot) {
      return { sent: false, reason: 'telegram_disabled' };
    }

    await this.bot.api.sendMessage(telegramId, message);
    return { sent: true };
  }
}
