import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BotLang } from './bot.messages';

export type BotFlow = 'newdeal';
export type NewDealStep =
  | 'ask_role'
  | 'ask_title'
  | 'ask_price'
  | 'ask_extra' // product_type (seller) or note (buyer)
  | 'done';

export interface BotStateData {
  chatId: string;
  flow: BotFlow | null;
  step: NewDealStep | null;
  creatorRole: 'buyer' | 'seller' | null;
  language: BotLang;
  productTitle: string | null;
  amount: string | null;
  productType: string | null;
  note: string | null;
  expiresAt: Date | null;
  /** Number of consecutive invalid amount attempts */
  amountRetryCount: number;
}

/** Conversation TTL in minutes */
const STATE_TTL_MINUTES = 10;

@Injectable()
export class BotStateService {
  private readonly logger = new Logger(BotStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(chatId: string): Promise<BotStateData | null> {
    const row = await this.prisma.botState.findUnique({ where: { chatId } });
    if (!row) return null;

    // expire stale flows
    if (row.expiresAt && row.expiresAt < new Date()) {
      await this.clearFlow(chatId);
      return {
        chatId,
        flow: null,
        step: null,
        creatorRole: null,
        language: (row.language as BotLang) ?? 'en',
        productTitle: null,
        amount: null,
        productType: null,
        note: null,
        expiresAt: null,
        amountRetryCount: 0,
      };
    }

    return {
      chatId: row.chatId,
      flow: (row.flow as BotFlow) ?? null,
      step: (row.step as NewDealStep) ?? null,
      creatorRole: (row.creatorRole as 'buyer' | 'seller') ?? null,
      language: (row.language as BotLang) ?? 'en',
      productTitle: row.productTitle ?? null,
      amount: row.amount ?? null,
      productType: row.productType ?? null,
      note: row.note ?? null,
      expiresAt: row.expiresAt ?? null,
      amountRetryCount: 0,
    };
  }

  async upsertLanguage(chatId: string, language: BotLang): Promise<void> {
    await this.prisma.botState.upsert({
      where: { chatId },
      create: { chatId, language },
      update: { language },
    });
  }

  async startNewDeal(chatId: string): Promise<void> {
    const expires = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);
    await this.prisma.botState.upsert({
      where: { chatId },
      create: {
        chatId,
        flow: 'newdeal',
        step: 'ask_role',
        expiresAt: expires,
      },
      update: {
        flow: 'newdeal',
        step: 'ask_role',
        creatorRole: null,
        productTitle: null,
        amount: null,
        productType: null,
        note: null,
        expiresAt: expires,
      },
    });
  }

  async update(chatId: string, patch: Partial<Omit<BotStateData, 'chatId'>>): Promise<void> {
    const expires = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);
    await this.prisma.botState.upsert({
      where: { chatId },
      create: {
        chatId,
        flow: patch.flow ?? null,
        step: patch.step ?? null,
        creatorRole: patch.creatorRole ?? null,
        language: patch.language ?? 'en',
        productTitle: patch.productTitle ?? null,
        amount: patch.amount ?? null,
        productType: patch.productType ?? null,
        note: patch.note ?? null,
        expiresAt: expires,
      },
      update: {
        ...(patch.flow !== undefined && { flow: patch.flow }),
        ...(patch.step !== undefined && { step: patch.step }),
        ...(patch.creatorRole !== undefined && { creatorRole: patch.creatorRole }),
        ...(patch.language !== undefined && { language: patch.language }),
        ...(patch.productTitle !== undefined && { productTitle: patch.productTitle }),
        ...(patch.amount !== undefined && { amount: patch.amount }),
        ...(patch.productType !== undefined && { productType: patch.productType }),
        ...(patch.note !== undefined && { note: patch.note }),
        expiresAt: expires,
      },
    });
  }

  async clearFlow(chatId: string): Promise<void> {
    try {
      await this.prisma.botState.update({
        where: { chatId },
        data: {
          flow: null,
          step: null,
          creatorRole: null,
          productTitle: null,
          amount: null,
          productType: null,
          note: null,
          expiresAt: null,
        },
      });
    } catch {
      this.logger.warn(`clearFlow: no state row found for chatId=${chatId}`);
    }
  }

  async ensureIdentity(
    chatId: string,
    info: { username?: string; firstName?: string; lastName?: string },
  ): Promise<void> {
    await this.prisma.telegramIdentity.upsert({
      where: { chatId },
      create: {
        chatId,
        username: info.username ?? null,
        firstName: info.firstName ?? null,
        lastName: info.lastName ?? null,
      },
      update: {
        username: info.username ?? undefined,
        firstName: info.firstName ?? undefined,
        lastName: info.lastName ?? undefined,
      },
    });
  }

  /** Delete all expired conversation states. Call from a scheduled job. */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.botState.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      return result.count;
    } catch (err) {
      this.logger.warn(`cleanupExpired failed: ${(err as Error).message}`);
      return 0;
    }
  }
}
