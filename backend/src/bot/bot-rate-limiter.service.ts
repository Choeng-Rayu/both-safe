import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

/**
 * BotRateLimiterService — sliding-window rate limiting for bot commands and deal creation.
 * Stores counters in the database (BotState table) for simplicity in MVP.
 */
@Injectable()
export class BotRateLimiterService {
  private readonly logger = new Logger(BotRateLimiterService.name);
  private readonly dealLimitPerHour: number;
  private readonly commandLimitPerMinute: number;
  private readonly dedupWindowMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {
    this.dealLimitPerHour = Number(this.cfg.get<string>('BOT_RATE_LIMIT_DEALS_PER_HOUR') ?? '3');
    this.commandLimitPerMinute = Number(this.cfg.get<string>('BOT_RATE_LIMIT_COMMANDS_PER_MINUTE') ?? '10');
    this.dedupWindowMs = 2000;
  }

  /**
   * Check if a user can create a deal (sliding window: per hour).
   */
  async checkDealCreation(chatId: string): Promise<RateLimitResult> {
    return this.checkSlidingWindow(chatId, 'deal_creation', this.dealLimitPerHour, 60 * 60 * 1000);
  }

  /**
   * Check if a user can send a command (sliding window: per minute).
   */
  async checkCommand(chatId: string): Promise<RateLimitResult> {
    return this.checkSlidingWindow(chatId, 'command', this.commandLimitPerMinute, 60 * 1000);
  }

  /**
   * Record a deal creation attempt.
   */
  async recordDealCreation(chatId: string): Promise<void> {
    await this.recordHit(chatId, 'deal_creation');
  }

  /**
   * Record a command hit.
   */
  async recordCommand(chatId: string): Promise<void> {
    await this.recordHit(chatId, 'command');
  }

  /**
   * Deduplicate identical messages within a short window.
   * Returns true if this message is a duplicate and should be ignored.
   */
  async isDuplicateMessage(chatId: string, messageText: string): Promise<boolean> {
    const key = `last_msg:${chatId}`;
    const now = Date.now();

    const state = await this.prisma.botState.findUnique({
      where: { chatId },
      select: { note: true },
    });

    let lastEntry: { text: string; ts: number } | null = null;
    try {
      if (state?.note) {
        lastEntry = JSON.parse(state.note);
      }
    } catch {
      // ignore parse errors
    }

    if (lastEntry && lastEntry.text === messageText && now - lastEntry.ts < this.dedupWindowMs) {
      return true;
    }

    // Update the dedup entry
    await this.prisma.botState.update({
      where: { chatId },
      data: { note: JSON.stringify({ text: messageText, ts: now }) },
    });

    return false;
  }

  private async checkSlidingWindow(
    chatId: string,
    type: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // Use audit log timestamps as a proxy for rate limit tracking
    // For MVP simplicity, we query audit logs for bot actions
    const count = await this.prisma.auditLog.count({
      where: {
        actorType: 'system',
        action: { startsWith: `bot.${type}` },
        createdAt: { gte: windowStart },
        details: { contains: chatId },
      },
    });

    const remaining = Math.max(0, limit - count);
    const resetAt = new Date(now.getTime() + windowMs);

    if (count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
      };
    }

    return { allowed: true, remaining, resetAt };
  }

  private async recordHit(chatId: string, type: string): Promise<void> {
    // Stored in audit log for traceability
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: 'system',
          action: `bot.${type}.hit`,
          details: JSON.stringify({ telegram_chat_id: chatId, ts: new Date().toISOString() }),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record rate limit hit: ${(err as Error).message}`);
    }
  }
}
