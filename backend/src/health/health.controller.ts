import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { BotTelegramService } from '../bot/bot-telegram.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(BotTelegramService)
    private readonly botTelegram?: BotTelegramService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbOk = true;
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      dbOk = false;
    }

    const botHealth = (await this.botTelegram?.healthCheck()) ?? {
      status: 'disabled',
      ok: true,
    };

    const allOk = dbOk && botHealth.ok;

    return {
      status: allOk ? 'ok' : 'degraded',
      uptime_s: Math.floor(process.uptime()),
      db: dbOk,
      bot: botHealth,
      now: new Date().toISOString(),
    };
  }
}
