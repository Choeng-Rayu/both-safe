import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BotStateService } from './bot-state.service';

/**
 * BotCleanupService — scheduled job to clean up expired bot conversation states.
 * Runs every hour to delete stale BotState records.
 */
@Injectable()
export class BotCleanupService {
  private readonly logger = new Logger(BotCleanupService.name);

  constructor(private readonly botStateService: BotStateService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    try {
      const deleted = await this.botStateService.cleanupExpired();
      if (deleted > 0) {
        this.logger.log(`Cleaned up ${deleted} expired bot conversation states`);
      }
    } catch (err) {
      this.logger.error(`Bot cleanup failed: ${(err as Error).message}`);
    }
  }
}
