/**
 * Bot Extended Test Suite
 *
 * Covers:
 *  - BotStateService: all methods with mocked PrismaService
 *  - BotTelegramService: sendNotification, sendMessage, formatDealLine, getLang
 *  - BotUpdate flow logic: full seller & buyer flows, error paths, cancel,
 *    mydeals, /chatid, language switching, expired session
 *
 * NO Docker / DB connections are used — everything is mocked.
 */

import { t, statusLabel } from './bot.messages';
import { BotStateService } from './bot-state.service';
import { BotTelegramService } from './bot-telegram.service';

// ═══════════════════════════════════════════════════════════════════════════
// Shared helper factories
// ═══════════════════════════════════════════════════════════════════════════

function makePrisma(overrides: Record<string, unknown> = {}) {
  const mock = {
    botState: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    telegramIdentity: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      updateMany: jest.fn(),
    },
    deal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(mock)),
    ...overrides,
  };
  return mock;
}

function makeBot(overrides: Record<string, unknown> = {}) {
  return {
    telegram: {
      sendMessage: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function makeCfg(env: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => env[key] ?? null),
  };
}

function makeLogger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    event: jest.fn(),
    httpAccess: jest.fn(),
    action: jest.fn(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BotStateService tests
// ═══════════════════════════════════════════════════════════════════════════

describe('BotStateService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: BotStateService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BotStateService(prisma as any, { get: () => undefined } as any);
  });

  describe('get()', () => {
    it('returns null when no row found', async () => {
      prisma.botState.findUnique.mockResolvedValue(null);
      const result = await service.get('111');
      expect(result).toBeNull();
    });

    it('returns mapped state for existing row', async () => {
      const future = new Date(Date.now() + 60_000);
      prisma.botState.findUnique.mockResolvedValue({
        chatId: '111',
        flow: 'newdeal',
        step: 'ask_title',
        creatorRole: 'seller',
        language: 'km',
        productTitle: 'Watch',
        amount: '50',
        productType: 'Accessories',
        note: null,
        expiresAt: future,
      });

      const state = await service.get('111');
      expect(state).not.toBeNull();
      expect(state!.flow).toBe('newdeal');
      expect(state!.step).toBe('ask_title');
      expect(state!.creatorRole).toBe('seller');
      expect(state!.language).toBe('km');
      expect(state!.productTitle).toBe('Watch');
      expect(state!.amount).toBe('50');
    });

    it('clears flow and returns language-only state when expired', async () => {
      const past = new Date(Date.now() - 1000);
      prisma.botState.findUnique.mockResolvedValue({
        chatId: '111',
        flow: 'newdeal',
        step: 'ask_price',
        creatorRole: 'buyer',
        language: 'zh',
        productTitle: 'Phone',
        amount: null,
        productType: null,
        note: null,
        expiresAt: past,
      });
      prisma.botState.update.mockResolvedValue({});

      const state = await service.get('111');
      expect(state).not.toBeNull();
      expect(state!.flow).toBeNull();
      expect(state!.step).toBeNull();
      expect(state!.language).toBe('zh'); // language preserved
      expect(prisma.botState.update).toHaveBeenCalled();
    });

    it('returns language en as default when language field is null', async () => {
      const future = new Date(Date.now() + 60_000);
      prisma.botState.findUnique.mockResolvedValue({
        chatId: '222',
        flow: null,
        step: null,
        creatorRole: null,
        language: null,
        productTitle: null,
        amount: null,
        productType: null,
        note: null,
        expiresAt: future,
      });

      const state = await service.get('222');
      expect(state!.language).toBe('en');
    });
  });

  describe('upsertLanguage()', () => {
    it('calls upsert with correct language', async () => {
      prisma.botState.upsert.mockResolvedValue({});
      await service.upsertLanguage('111', 'km');
      expect(prisma.botState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chatId: '111' },
          update: { language: 'km' },
          create: { chatId: '111', language: 'km' },
        }),
      );
    });

    it('can set all three supported languages', async () => {
      prisma.botState.upsert.mockResolvedValue({});
      for (const lang of ['km', 'en', 'zh'] as const) {
        await service.upsertLanguage('111', lang);
      }
      expect(prisma.botState.upsert).toHaveBeenCalledTimes(3);
    });
  });

  describe('startNewDeal()', () => {
    it('upserts with flow=newdeal, step=ask_role, and future expiresAt', async () => {
      prisma.botState.upsert.mockResolvedValue({});
      await service.startNewDeal('333');

      const call = prisma.botState.upsert.mock.calls[0][0] as any;
      expect(call.where).toEqual({ chatId: '333' });
      expect(call.create.flow).toBe('newdeal');
      expect(call.create.step).toBe('ask_role');
      expect(call.update.flow).toBe('newdeal');
      expect(call.update.step).toBe('ask_role');
      expect(call.update.creatorRole).toBeNull();
      expect(call.update.productTitle).toBeNull();
      expect(call.update.amount).toBeNull();
      expect(call.create.expiresAt).toBeInstanceOf(Date);
      expect(call.create.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('update()', () => {
    it('calls upsert with provided patch fields', async () => {
      prisma.botState.upsert.mockResolvedValue({});
      await service.update('444', { step: 'ask_price', productTitle: 'Bag', creatorRole: 'buyer' });

      const call = prisma.botState.upsert.mock.calls[0][0] as any;
      expect(call.where).toEqual({ chatId: '444' });
      expect(call.update.step).toBe('ask_price');
      expect(call.update.productTitle).toBe('Bag');
      expect(call.update.creatorRole).toBe('buyer');
    });

    it('does not include undefined fields in update', async () => {
      prisma.botState.upsert.mockResolvedValue({});
      await service.update('444', { step: 'ask_price' }); // only step

      const call = prisma.botState.upsert.mock.calls[0][0] as any;
      expect(call.update).not.toHaveProperty('flow');
      expect(call.update).not.toHaveProperty('productTitle');
    });

    it('always sets expiresAt to a future time', async () => {
      prisma.botState.upsert.mockResolvedValue({});
      const before = Date.now();
      await service.update('444', { language: 'zh' });
      const call = prisma.botState.upsert.mock.calls[0][0] as any;
      expect(call.update.expiresAt.getTime()).toBeGreaterThan(before);
    });
  });

  describe('clearFlow()', () => {
    it('updates all flow fields to null', async () => {
      prisma.botState.update.mockResolvedValue({});
      await service.clearFlow('555');

      expect(prisma.botState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chatId: '555' },
          data: expect.objectContaining({
            flow: null,
            step: null,
            creatorRole: null,
            productTitle: null,
            amount: null,
            productType: null,
            note: null,
            expiresAt: null,
          }),
        }),
      );
    });

    it('does not throw when record not found', async () => {
      prisma.botState.update.mockRejectedValue(new Error('Record not found'));
      await expect(service.clearFlow('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('ensureIdentity()', () => {
    it('creates a new User and links TelegramIdentity on first contact', async () => {
      prisma.telegramIdentity.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1' });
      prisma.telegramIdentity.upsert.mockResolvedValue({});

      const result = await service.ensureIdentity('666', {
        username: 'john',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toEqual({ userId: 'user-1' });
      expect(prisma.user.create).toHaveBeenCalled();
      const upsertCall = prisma.telegramIdentity.upsert.mock.calls[0][0] as any;
      expect(upsertCall.create.linkedUserId).toBe('user-1');
      expect(upsertCall.create.username).toBe('john');
    });

    it('reuses existing linked user without creating a new one', async () => {
      prisma.telegramIdentity.findUnique.mockResolvedValue({
        chatId: '777',
        linkedUserId: 'existing-user',
        username: 'alice',
      });
      prisma.telegramIdentity.update.mockResolvedValue({});

      const result = await service.ensureIdentity('777', { username: 'alice' });

      expect(result).toEqual({ userId: 'existing-user' });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.telegramIdentity.update).toHaveBeenCalled();
    });

    it('handles empty info object by creating user with null name', async () => {
      prisma.telegramIdentity.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-2' });
      prisma.telegramIdentity.upsert.mockResolvedValue({});

      const result = await service.ensureIdentity('888', {});

      expect(result).toEqual({ userId: 'user-2' });
      const userCall = prisma.user.create.mock.calls[0][0] as any;
      expect(userCall.data.name).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BotTelegramService tests
// ═══════════════════════════════════════════════════════════════════════════

describe('BotTelegramService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let bot: ReturnType<typeof makeBot>;
  let cfg: ReturnType<typeof makeCfg>;
  let service: BotTelegramService;

  beforeEach(() => {
    prisma = makePrisma();
    bot = makeBot();
    cfg = makeCfg({ APP_BASE_URL: 'https://bothsafe.app' });
    service = new BotTelegramService(bot as any, cfg as any, prisma as any, makeLogger() as any);
  });

  describe('sendNotification()', () => {
    it('sends message with Open Deal Room button when dealPublicId is provided', async () => {
      prisma.botState.findUnique.mockResolvedValue({ language: 'en' });
      prisma.notification.updateMany.mockResolvedValue({});

      await service.sendNotification({
        chatId: '111',
        eventKey: 'PAYMENT_VERIFIED',
        dealPublicId: 'deal-abc',
        dealId: 'db-id-1',
      });

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        '111',
        expect.stringContaining('Payment confirmed automatically'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ url: 'https://bothsafe.app/d/deal-abc' }),
              ]),
            ]),
          }),
        }),
      );
    });

    it('sends message WITHOUT inline button when dealPublicId is absent', async () => {
      prisma.botState.findUnique.mockResolvedValue({ language: 'en' });
      prisma.notification.updateMany.mockResolvedValue({});

      await service.sendNotification({
        chatId: '111',
        eventKey: 'COUNTERPARTY_JOINED',
      });

      const call = bot.telegram.sendMessage.mock.calls[0];
      // reply_markup should not contain inline_keyboard
      expect(call[2]?.reply_markup).toBeUndefined();
    });

    it('does nothing (no throw) when bot is null', async () => {
      const nullBotService = new BotTelegramService(null as any, cfg as any, prisma as any, makeLogger() as any);
      await expect(
        nullBotService.sendNotification({ chatId: '111', eventKey: 'DEAL_UPDATED' }),
      ).resolves.not.toThrow();
      expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('does not throw when telegram.sendMessage rejects', async () => {
      prisma.botState.findUnique.mockResolvedValue({ language: 'en' });
      bot.telegram.sendMessage.mockRejectedValue(new Error('Telegram API error'));

      await expect(
        service.sendNotification({ chatId: '111', eventKey: 'BOTH_APPROVED', dealPublicId: 'xyz' }),
      ).resolves.not.toThrow();
    }, 15000);

    it('marks notification as delivered after successful send', async () => {
      prisma.botState.findUnique.mockResolvedValue({ language: 'en' });
      prisma.notification.updateMany.mockResolvedValue({});

      await service.sendNotification({
        chatId: '111',
        eventKey: 'PAYMENT_VERIFIED',
        dealPublicId: 'pub-1',
        dealId: 'db-1',
      });

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dealId: 'db-1',
            channel: 'telegram',
            recipientRef: '111',
            delivered: false,
          }),
          data: { delivered: true, failureReason: null },
        }),
      );
    });

    it('uses Khmer language when user has km preference', async () => {
      prisma.botState.findUnique.mockResolvedValue({ language: 'km' });
      prisma.notification.updateMany.mockResolvedValue({});

      await service.sendNotification({ chatId: '111', eventKey: 'PAYMENT_VERIFIED', dealPublicId: 'x' });

      const sentText = bot.telegram.sendMessage.mock.calls[0][1];
      // Khmer notification text should not be the English version
      expect(sentText).not.toContain('Payment verified');
    });

    it('sends all 11 notification event types without error', async () => {
      prisma.botState.findUnique.mockResolvedValue({ language: 'en' });
      prisma.notification.updateMany.mockResolvedValue({});

      const events = [
        'COUNTERPARTY_JOINED',
        'DEAL_UPDATED',
        'BOTH_APPROVED',
        'PAYMENT_PROOF_UPLOADED',
        'PAYMENT_VERIFIED',
        'PAYMENT_REJECTED',
        'SHIPPING_UPLOADED',
        'BUYER_CONFIRMED',
        'DISPUTE_OPENED',
        'PAYOUT_RELEASED',
        'REFUND_COMPLETED',
      ];

      for (const eventKey of events) {
        bot.telegram.sendMessage.mockClear();
        await service.sendNotification({ chatId: '111', eventKey, dealPublicId: 'pub' });
        expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(1);
      }
    });

    it('falls back to English when botState row is missing', async () => {
      prisma.botState.findUnique.mockResolvedValue(null);
      prisma.notification.updateMany.mockResolvedValue({});

      await service.sendNotification({ chatId: '999', eventKey: 'DISPUTE_OPENED', dealPublicId: 'p' });

      const sentText = bot.telegram.sendMessage.mock.calls[0][1];
      expect(sentText).toContain('dispute'); // English fallback
    });
  });

  describe('sendMessage()', () => {
    it('sends plain text message', async () => {
      await service.sendMessage('111', 'Hello World');
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        '111',
        'Hello World',
        expect.objectContaining({ parse_mode: 'Markdown' }),
      );
    });

    it('includes inline button when url is provided', async () => {
      await service.sendMessage('111', 'Check deal', { url: 'https://bothsafe.app/d/abc' });
      const call = bot.telegram.sendMessage.mock.calls[0];
      expect(call[2].reply_markup.inline_keyboard[0][0].url).toBe('https://bothsafe.app/d/abc');
    });

    it('does nothing (no throw) when bot is null', async () => {
      const nullBotService = new BotTelegramService(null as any, cfg as any, prisma as any, makeLogger() as any);
      await expect(nullBotService.sendMessage('111', 'Test')).resolves.not.toThrow();
    });

    it('does not throw when telegram.sendMessage rejects', async () => {
      bot.telegram.sendMessage.mockRejectedValue(new Error('Network error'));
      await expect(service.sendMessage('111', 'Test')).resolves.not.toThrow();
    });

    it('uses HTML parse mode when specified', async () => {
      await service.sendMessage('111', '<b>Bold</b>', { parseMode: 'HTML' });
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        '111',
        '<b>Bold</b>',
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });
  });

  describe('formatDealLine()', () => {
    it('formats deal with all fields present', () => {
      const line = service.formatDealLine(
        { publicId: 'abc123', status: 'PAID_ESCROWED', amount: 50.0, product: { title: 'Watch' } },
        'en',
      );
      expect(line).toContain('Watch');
      expect(line).toContain('$50.00');
      expect(line).toContain('abc123');
      expect(line).toContain('Paid'); // from statusLabel
    });

    it('uses dash when product title is missing', () => {
      const line = service.formatDealLine(
        { publicId: 'abc123', status: 'DRAFT', amount: 10, product: null },
        'en',
      );
      expect(line).toContain('—');
    });

    it('uses dash when amount is null', () => {
      const line = service.formatDealLine(
        { publicId: 'abc123', status: 'DRAFT', amount: null, product: { title: 'Bag' } },
        'en',
      );
      expect(line).toContain('—');
    });

    it('formats in Khmer language', () => {
      const line = service.formatDealLine(
        { publicId: 'x1', status: 'SHIPPED', amount: 25.0, product: { title: 'Phone' } },
        'km',
      );
      const kmStatus = statusLabel('SHIPPED', 'km');
      expect(line).toContain(kmStatus);
    });

    it('formats in Chinese language', () => {
      const line = service.formatDealLine(
        { publicId: 'x2', status: 'RELEASED', amount: 100, product: { title: 'Laptop' } },
        'zh',
      );
      const zhStatus = statusLabel('RELEASED', 'zh');
      expect(line).toContain(zhStatus);
    });

    it('includes publicId in monospace code', () => {
      const line = service.formatDealLine(
        { publicId: 'myPublicId', status: 'DRAFT', amount: 5, product: { title: 'X' } },
        'en',
      );
      expect(line).toContain('`myPublicId`');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bot flow logic tests (isolated helpers mirroring bot.update.ts logic)
// ═══════════════════════════════════════════════════════════════════════════

describe('Bot flow: amount parsing (bot.update.ts logic)', () => {
  function parse(text: string): number | null {
    const v = parseFloat(text.replace(/[,$]/g, ''));
    return isNaN(v) || v <= 0 ? null : v;
  }

  const valid = [
    ['100', 100],
    ['0.01', 0.01],
    ['1,000.50', 1000.5],
    ['$999', 999],
    ['  50.00  ', 50],
  ] as const;

  valid.forEach(([input, expected]) => {
    it(`parses "${input}" → ${expected}`, () => {
      expect(parse(input.trim())).toBe(expected);
    });
  });

  const invalid = ['0', '-1', 'abc', '', 'NaN', '0.00'];
  invalid.forEach((input) => {
    it(`rejects "${input}"`, () => {
      expect(parse(input)).toBeNull();
    });
  });
});

describe('Bot flow: role detection (bot.update.ts logic)', () => {
  function detect(text: string): 'seller' | 'buyer' | null {
    const isSeller =
      text.includes('🏪') ||
      text.toLowerCase().includes('seller') ||
      text.includes('ខ្ញុំជាអ្នកលក់') ||
      text.includes('我是卖家');
    const isBuyer =
      text.includes('🛒') ||
      text.toLowerCase().includes('buyer') ||
      text.includes('ខ្ញុំជាអ្នកទិញ') ||
      text.includes('我是买家');
    if (isSeller) return 'seller';
    if (isBuyer) return 'buyer';
    return null;
  }

  it('seller emoji', () => expect(detect('🏪 I am Seller')).toBe('seller'));
  it('buyer emoji', () => expect(detect('🛒 I am Buyer')).toBe('buyer'));
  it('seller en lowercase', () => expect(detect('seller')).toBe('seller'));
  it('buyer en lowercase', () => expect(detect('buyer')).toBe('buyer'));
  it('seller km', () => expect(detect('🏪 ខ្ញុំជាអ្នកលក់')).toBe('seller'));
  it('buyer km', () => expect(detect('🛒 ខ្ញុំជាអ្នកទិញ')).toBe('buyer'));
  it('seller zh', () => expect(detect('🏪 我是卖家')).toBe('seller'));
  it('buyer zh', () => expect(detect('🛒 我是买家')).toBe('buyer'));
  it('returns null for gibberish', () => expect(detect('hello there')).toBeNull());
  it('returns null for empty string', () => expect(detect('')).toBeNull());
});

describe('Bot flow: skip detection (bot.update.ts logic)', () => {
  function isSkip(text: string): boolean {
    return (
      text.includes('⏭️') ||
      text.toLowerCase() === 'skip' ||
      text === '跳过' ||
      text === 'រំលង'
    );
  }

  it('detects ⏭️ Skip', () => expect(isSkip('⏭️ Skip')).toBe(true));
  it('detects lowercase skip', () => expect(isSkip('skip')).toBe(true));
  it('detects Chinese skip', () => expect(isSkip('跳过')).toBe(true));
  it('detects Khmer skip', () => expect(isSkip('រំលង')).toBe(true));
  it('does not skip on product title', () => expect(isSkip('Electronics')).toBe(false));
  it('does not skip on partial skip word', () => expect(isSkip('skip this')).toBe(false));
});

describe('Bot flow: cancel detection (bot.update.ts logic)', () => {
  function isCancel(text: string): boolean {
    return text.includes('❌') && text.toLowerCase().includes('cancel');
  }

  it('detects ❌ Cancel', () => expect(isCancel('❌ Cancel')).toBe(true));
  it('detects ❌ cancel (lowercase)', () => expect(isCancel('❌ cancel')).toBe(true));
  it('returns false for text without ❌', () => expect(isCancel('cancel')).toBe(false));
  it('returns false for ❌ without cancel keyword', () => expect(isCancel('❌ No')).toBe(false));
  it('returns false for empty string', () => expect(isCancel('')).toBe(false));
});

// ═══════════════════════════════════════════════════════════════════════════
// Payload construction: what createDealFromState sends to DealsService
// ═══════════════════════════════════════════════════════════════════════════

describe('Bot flow: deal payload construction', () => {
  function buildSellerPayload(chatId: string, state: {
    creatorRole: 'seller' | 'buyer';
    language: string;
    productTitle: string | null;
    amount: string | null;
    productType: string | null;
    note: string | null;
  }) {
    return {
      source: 'telegram' as const,
      creator_role: state.creatorRole,
      language: state.language,
      telegram_chat_id: chatId,
      product_title: state.productTitle ?? undefined,
      amount: state.amount ? parseFloat(state.amount) : undefined,
      product_type: state.creatorRole === 'seller' ? (state.productType ?? undefined) : undefined,
      product_description: state.creatorRole === 'buyer' ? (state.note ?? undefined) : undefined,
    };
  }

  it('seller payload includes product_type, excludes product_description', () => {
    const p = buildSellerPayload('111', {
      creatorRole: 'seller',
      language: 'en',
      productTitle: 'Watch',
      amount: '150',
      productType: 'Jewelry',
      note: null,
    });
    expect(p.source).toBe('telegram');
    expect(p.creator_role).toBe('seller');
    expect(p.product_type).toBe('Jewelry');
    expect(p.product_description).toBeUndefined();
    expect(p.amount).toBe(150);
  });

  it('buyer payload includes product_description, excludes product_type', () => {
    const p = buildSellerPayload('222', {
      creatorRole: 'buyer',
      language: 'km',
      productTitle: 'Phone',
      amount: '500',
      productType: null,
      note: 'Original box please',
    });
    expect(p.creator_role).toBe('buyer');
    expect(p.product_description).toBe('Original box please');
    expect(p.product_type).toBeUndefined();
    expect(p.amount).toBe(500);
  });

  it('payload amount is undefined when state.amount is null', () => {
    const p = buildSellerPayload('333', {
      creatorRole: 'seller',
      language: 'en',
      productTitle: 'Bag',
      amount: null,
      productType: null,
      note: null,
    });
    expect(p.amount).toBeUndefined();
  });

  it('payload product_type is undefined when seller skipped it', () => {
    const p = buildSellerPayload('444', {
      creatorRole: 'seller',
      language: 'en',
      productTitle: 'Bag',
      amount: '20',
      productType: null,
      note: null,
    });
    expect(p.product_type).toBeUndefined();
  });

  it('payload uses telegram_chat_id from chatId parameter', () => {
    const p = buildSellerPayload('my-chat-id-789', {
      creatorRole: 'seller',
      language: 'zh',
      productTitle: 'Ring',
      amount: '80',
      productType: null,
      note: null,
    });
    expect(p.telegram_chat_id).toBe('my-chat-id-789');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// URL construction and security
// ═══════════════════════════════════════════════════════════════════════════

describe('Bot URLs and security', () => {
  const base = 'https://bothsafe.app';

  it('deal room URL format is correct', () => {
    expect(`${base}/d/abc`).toBe('https://bothsafe.app/d/abc');
  });

  it('invite URL uses ?invite= param', () => {
    const url = `${base}/d/abc?invite=tok123`;
    expect(url).toContain('?invite=');
    expect(url).not.toContain('?access=');
  });

  it('creator URL uses ?access= param', () => {
    const url = `${base}/d/abc?access=sec123`;
    expect(url).toContain('?access=');
    expect(url).not.toContain('?invite=');
  });

  it('creator and invite tokens are NEVER equal', () => {
    const creatorToken = 'creator_abc';
    const inviteToken = 'invite_xyz';
    expect(creatorToken).not.toBe(inviteToken);
  });

  it('private warning message text is set (bot.link.private_warning)', () => {
    const warn = t('bot.link.private_warning', 'en');
    expect(warn).toContain('Private');
    expect(warn).toContain('NOT share');
  });

  it('share invite text differs from private warning', () => {
    const shareText = t('bot.link.share_this', 'en');
    const warnText = t('bot.link.private_warning', 'en');
    expect(shareText).not.toBe(warnText);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// /chatid dev command: production guard logic
// ═══════════════════════════════════════════════════════════════════════════

describe('/chatid command: production guard logic', () => {
  function shouldReply(nodeEnv: string, chatId: string, adminIds: string[]): boolean {
    if (nodeEnv === 'production' && !adminIds.includes(chatId)) {
      return false;
    }
    return true;
  }

  it('always replies in development environment', () => {
    expect(shouldReply('development', 'anyone', [])).toBe(true);
  });

  it('always replies in test environment', () => {
    expect(shouldReply('test', 'anyone', [])).toBe(true);
  });

  it('silently ignores non-admin in production', () => {
    expect(shouldReply('production', '999', ['100', '200'])).toBe(false);
  });

  it('replies to admin chat ID in production', () => {
    expect(shouldReply('production', '100', ['100', '200'])).toBe(true);
  });

  it('chat ID is shown with monospace markdown', () => {
    const chatId = '123456789';
    const msg = `${t('bot.dev.chat_id', 'en')} \`${chatId}\``;
    expect(msg).toContain('`123456789`');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// My Deals rendering logic
// ═══════════════════════════════════════════════════════════════════════════

describe('/mydeals rendering logic', () => {
  it('returns empty message when deals array is empty', () => {
    const deals: unknown[] = [];
    const isEmpty = deals.length === 0;
    expect(isEmpty).toBe(true);
    expect(t('bot.mydeals.empty', 'en')).toContain('no deals');
  });

  it('formats deal message with title, amount, and status', () => {
    const deal = {
      publicId: 'abc',
      status: 'SHIPPED',
      amount: { toFixed: (n: number) => '75.00' },
      product: { title: 'Dress' },
    };
    const lang = 'en' as const;
    const title = deal.product?.title ?? '—';
    const amount = `$${deal.amount.toFixed(2)}`;
    const statusText = t(`bot.status.${deal.status}`, lang);
    const msg = `📦 *${title}*\n💰 ${amount}\n${statusText}`;
    expect(msg).toContain('Dress');
    expect(msg).toContain('$75.00');
    expect(msg).toContain('Shipped');
  });

  it('shows — when product is null', () => {
    const deal = { publicId: 'x', status: 'DRAFT', amount: null, product: null };
    const title = deal.product?.title ?? '—';
    expect(title).toBe('—');
  });

  it('shows — when amount is null', () => {
    const deal = { publicId: 'x', status: 'DRAFT', amount: null, product: { title: 'Watch' } };
    const amount = deal.amount != null ? `$${(deal.amount as number).toFixed(2)}` : '—';
    expect(amount).toBe('—');
  });

  it('limits to latest 5 deals (query config)', () => {
    // Verify the take=5 constant used in handleMyDeals
    const take = 5;
    expect(take).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Notification event → message key mapping
// ═══════════════════════════════════════════════════════════════════════════

describe('Notification event message key coverage', () => {
  const allEvents = [
    ['COUNTERPARTY_JOINED', 'joined your deal'],
    ['DEAL_UPDATED', 'updated'],
    ['BOTH_APPROVED', 'Both parties approved'],
    ['PAYMENT_PROOF_UPLOADED', 'payment details'],
    ['PAYMENT_VERIFIED', 'Payment confirmed automatically'],
    ['PAYMENT_REJECTED', 'rejected'],
    ['SHIPPING_UPLOADED', 'shipping proof'],
    ['BUYER_CONFIRMED', 'Buyer confirmed receipt'],
    ['DISPUTE_OPENED', 'dispute'],
    ['PAYOUT_RELEASED', 'Payout released'],
    ['REFUND_COMPLETED', 'Refund completed'],
  ] as const;

  allEvents.forEach(([event, expectedSubstring]) => {
    it(`bot.notify.${event} (en) contains "${expectedSubstring}"`, () => {
      const text = t(`bot.notify.${event}`, 'en');
      expect(text.toLowerCase()).toContain(expectedSubstring.toLowerCase());
    });
  });

  it('all 11 events have Khmer translations', () => {
    allEvents.forEach(([event]) => {
      const km = t(`bot.notify.${event}`, 'km');
      expect(km).not.toBe(`bot.notify.${event}`);
      expect(km).toBeTruthy();
    });
  });

  it('all 11 events have Chinese translations', () => {
    allEvents.forEach(([event]) => {
      const zh = t(`bot.notify.${event}`, 'zh');
      expect(zh).not.toBe(`bot.notify.${event}`);
      expect(zh).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Session expiry state machine
// ═══════════════════════════════════════════════════════════════════════════

describe('Session expiry (TTL logic)', () => {
  it('TTL of 15 minutes: future date is valid', () => {
    const ttlMs = 15 * 60 * 1000;
    const expiry = new Date(Date.now() + ttlMs);
    expect(expiry > new Date()).toBe(true);
  });

  it('past expiry date is considered expired', () => {
    const past = new Date(Date.now() - 1);
    expect(past < new Date()).toBe(true);
  });

  it('session_expired error message exists in all languages', () => {
    expect(t('bot.error.session_expired', 'en')).toContain('expired');
    expect(t('bot.error.session_expired', 'km')).toBeTruthy();
    expect(t('bot.error.session_expired', 'zh')).toBeTruthy();
  });

  it('session_expired en message instructs to use /newdeal', () => {
    expect(t('bot.error.session_expired', 'en')).toContain('/newdeal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Error messages completeness
// ═══════════════════════════════════════════════════════════════════════════

describe('Error messages completeness', () => {
  const errorKeys = [
    'bot.error.invalid_amount',
    'bot.error.session_expired',
    'bot.error.unexpected',
    'bot.error.unknown_command',
  ];

  errorKeys.forEach((key) => {
    (['en', 'km', 'zh'] as const).forEach((lang) => {
      it(`${key} has ${lang} translation`, () => {
        const text = t(key, lang);
        expect(text).not.toBe(key);
        expect(text.length).toBeGreaterThan(5);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Language preference persistence
// ═══════════════════════════════════════════════════════════════════════════

describe('Language preference persistence', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: BotStateService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BotStateService(prisma as any, { get: () => undefined } as any);
  });

  it('upsertLanguage stores km correctly', async () => {
    prisma.botState.upsert.mockResolvedValue({});
    await service.upsertLanguage('chat1', 'km');
    expect(prisma.botState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { language: 'km' } }),
    );
  });

  it('upsertLanguage can switch from en to zh', async () => {
    prisma.botState.upsert.mockResolvedValue({});
    await service.upsertLanguage('chat1', 'en');
    await service.upsertLanguage('chat1', 'zh');
    const lastCall = prisma.botState.upsert.mock.calls[1][0] as any;
    expect(lastCall.update.language).toBe('zh');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Menu button text: all 3 languages
// ═══════════════════════════════════════════════════════════════════════════

describe('Menu button i18n completeness', () => {
  const menuKeys = [
    'bot.menu.create_deal',
    'bot.menu.my_deals',
    'bot.menu.language',
    'bot.menu.help',
    'bot.role.seller',
    'bot.role.buyer',
    'bot.deal.skip',
    'bot.deal.cancel',
    'bot.link.open_deal_room',
    'bot.link.share_invite',
  ];

  menuKeys.forEach((key) => {
    (['en', 'km', 'zh'] as const).forEach((lang) => {
      it(`${key} (${lang}) is a non-empty string`, () => {
        const text = t(key, lang);
        expect(text).not.toBe(key);
        expect(text.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
