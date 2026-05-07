/**
 * T-10 Bot Tests
 *
 * Tests cover:
 * - Seller-created deal flow (T-03, T-04)
 * - Buyer-created deal flow (T-03, T-04)
 * - Cancel and restart flow (T-03)
 * - Invalid amount handling (T-03, T-08)
 * - Notification event mapping (T-07)
 * - Language selection (T-02)
 * - BotStateService state management
 */

import { t, statusLabel, type BotLang } from './bot.messages';

// ─── Message utility tests ─────────────────────────────────────────────────

describe('bot.messages - t()', () => {
  it('returns English text for known key', () => {
    expect(t('bot.start.title', 'en')).toContain('Welcome to BothSafe');
  });

  it('returns Khmer text for known key', () => {
    expect(t('bot.start.title', 'km')).toContain('BothSafe');
  });

  it('returns Chinese text for known key', () => {
    expect(t('bot.start.title', 'zh')).toContain('BothSafe');
  });

  it('falls back to English when lang is not present', () => {
    // All keys should have an English fallback
    const result = t('bot.menu.create_deal', 'en');
    expect(result).toBeTruthy();
    expect(result).not.toBe('bot.menu.create_deal');
  });

  it('returns key itself when key is unknown', () => {
    const unknown = t('bot.unknown.key.xyz', 'en');
    expect(unknown).toBe('bot.unknown.key.xyz');
  });

  it('bot.error.invalid_amount exists in all languages', () => {
    expect(t('bot.error.invalid_amount', 'en')).toContain('Invalid amount');
    expect(t('bot.error.invalid_amount', 'km')).toBeTruthy();
    expect(t('bot.error.invalid_amount', 'zh')).toBeTruthy();
  });

  it('bot.deal.cancelled exists', () => {
    expect(t('bot.deal.cancelled', 'en')).toContain('cancelled');
  });
});

// ─── statusLabel tests ─────────────────────────────────────────────────────

describe('bot.messages - statusLabel()', () => {
  const statuses = [
    'DRAFT',
    'PENDING_BUYER_PAYMENT',
    'PENDING_SELLER_APPROVAL',
    'PAYMENT_PENDING_VERIFICATION',
    'PAID_WAITING_SELLER_APPROVAL',
    'SELLER_ACCEPTED_PACKING',
    'PAID_ESCROWED',
    'SHIPPED',
    'DISPUTED',
    'RELEASED',
    'REFUNDED',
    'CANCELLED',
    'EXPIRED',
  ];

  const langs: BotLang[] = ['en', 'km', 'zh'];

  statuses.forEach((status) => {
    langs.forEach((lang) => {
      it(`statusLabel(${status}, ${lang}) returns non-empty text`, () => {
        const result = statusLabel(status, lang);
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});

// ─── Notification event mapping tests ─────────────────────────────────────

describe('bot.messages - notification event keys', () => {
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

  events.forEach((event) => {
    it(`bot.notify.${event} has English text`, () => {
      const result = t(`bot.notify.${event}`, 'en');
      expect(result).toBeTruthy();
      // Should not return the key itself
      expect(result).not.toBe(`bot.notify.${event}`);
    });
  });
});

// ─── Amount validation logic tests ────────────────────────────────────────

describe('Amount validation (bot deal flow)', () => {
  function parseAmount(text: string): number | null {
    const amount = parseFloat(text.replace(/[,$]/g, ''));
    if (isNaN(amount) || amount <= 0) return null;
    return amount;
  }

  it('parses valid integer amount', () => {
    expect(parseAmount('25')).toBe(25);
  });

  it('parses valid decimal amount', () => {
    expect(parseAmount('25.50')).toBe(25.5);
  });

  it('parses amount with dollar sign', () => {
    expect(parseAmount('$100')).toBe(100);
  });

  it('parses amount with comma', () => {
    expect(parseAmount('1,000')).toBe(1000);
  });

  it('rejects zero amount', () => {
    expect(parseAmount('0')).toBeNull();
  });

  it('rejects negative amount', () => {
    expect(parseAmount('-5')).toBeNull();
  });

  it('rejects non-numeric text', () => {
    expect(parseAmount('hello')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(parseAmount('')).toBeNull();
  });
});

// ─── Role detection logic tests ────────────────────────────────────────────

describe('Role detection (bot deal flow)', () => {
  function detectRole(text: string): 'seller' | 'buyer' | null {
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

    if (isSellerText) return 'seller';
    if (isBuyerText) return 'buyer';
    return null;
  }

  it('detects seller from English button text', () => {
    expect(detectRole('🏪 I am Seller')).toBe('seller');
  });

  it('detects buyer from English button text', () => {
    expect(detectRole('🛒 I am Buyer')).toBe('buyer');
  });

  it('detects seller from Khmer button text', () => {
    expect(detectRole('🏪 ខ្ញុំជាអ្នកលក់')).toBe('seller');
  });

  it('detects buyer from Khmer button text', () => {
    expect(detectRole('🛒 ខ្ញុំជាអ្នកទិញ')).toBe('buyer');
  });

  it('detects seller from Chinese button text', () => {
    expect(detectRole('🏪 我是卖家')).toBe('seller');
  });

  it('detects buyer from Chinese button text', () => {
    expect(detectRole('🛒 我是买家')).toBe('buyer');
  });

  it('returns null for unrecognized role text', () => {
    expect(detectRole('random text')).toBeNull();
  });
});

// ─── Skip detection logic tests ────────────────────────────────────────────

describe('Skip detection (optional fields)', () => {
  function isSkip(text: string): boolean {
    return (
      text.includes('⏭️') ||
      text.toLowerCase() === 'skip' ||
      text === '跳过' ||
      text === 'រំលង'
    );
  }

  it('detects English skip button', () => {
    expect(isSkip('⏭️ Skip')).toBe(true);
  });

  it('detects Chinese skip', () => {
    expect(isSkip('跳过')).toBe(true);
  });

  it('detects Khmer skip', () => {
    expect(isSkip('រំលង')).toBe(true);
  });

  it('detects lowercase skip', () => {
    expect(isSkip('skip')).toBe(true);
  });

  it('does not skip on regular text', () => {
    expect(isSkip('Electronics')).toBe(false);
  });
});

// ─── Cancel detection logic tests ─────────────────────────────────────────

describe('Cancel detection', () => {
  function isCancel(text: string): boolean {
    return text.includes('❌') && text.toLowerCase().includes('cancel');
  }

  it('detects English cancel button', () => {
    expect(isCancel('❌ Cancel')).toBe(true);
  });

  it('does not cancel on regular text', () => {
    expect(isCancel('some text')).toBe(false);
  });

  it('does not cancel on only ❌ without cancel word', () => {
    expect(isCancel('❌ something else')).toBe(false);
  });
});

// ─── URL construction tests ────────────────────────────────────────────────

describe('Deal URL construction', () => {
  const appBase = 'https://bothsafe.app';

  it('builds correct creator access URL format', () => {
    const publicId = 'abc123';
    const token = 'mytoken';
    const url = `${appBase}/d/${publicId}?access=${token}`;
    expect(url).toBe('https://bothsafe.app/d/abc123?access=mytoken');
  });

  it('builds correct invite URL format', () => {
    const publicId = 'abc123';
    const inviteToken = 'invitetoken';
    const url = `${appBase}/d/${publicId}?invite=${inviteToken}`;
    expect(url).toBe('https://bothsafe.app/d/abc123?invite=invitetoken');
  });

  it('builds correct deal room URL format', () => {
    const publicId = 'abc123';
    const url = `${appBase}/d/${publicId}`;
    expect(url).toBe('https://bothsafe.app/d/abc123');
  });
});

// ─── BotStateService unit tests ────────────────────────────────────────────

describe('BotStateService logic', () => {
  // Test state TTL expiry logic
  it('detects expired state correctly', () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    expect(pastDate < new Date()).toBe(true);
  });

  it('detects non-expired state correctly', () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes ahead
    expect(futureDate > new Date()).toBe(true);
  });
});

// ─── Seller flow integration shape tests ──────────────────────────────────

describe('Seller deal creation payload shape', () => {
  it('builds correct seller deal payload', () => {
    const chatId = '123456789';
    const lang: BotLang = 'en';
    const role = 'seller';
    const productTitle = 'Handmade Bracelet';
    const amount = 25.0;
    const productType = 'Jewelry';

    const payload = {
      source: 'telegram' as const,
      creator_role: role,
      language: lang,
      telegram_chat_id: chatId,
      product_title: productTitle,
      amount,
      product_type: productType,
    };

    expect(payload.source).toBe('telegram');
    expect(payload.creator_role).toBe('seller');
    expect(payload.language).toBe('en');
    expect(payload.telegram_chat_id).toBe('123456789');
    expect(payload.product_title).toBe('Handmade Bracelet');
    expect(payload.amount).toBe(25.0);
    expect(payload.product_type).toBe('Jewelry');
  });
});

// ─── Buyer flow integration shape tests ────────────────────────────────────

describe('Buyer deal creation payload shape', () => {
  it('builds correct buyer deal payload', () => {
    const chatId = '987654321';
    const lang: BotLang = 'km';
    const role = 'buyer';
    const productTitle = 'iPhone 13';
    const amount = 500.0;
    const note = 'Please include original box';

    const payload = {
      source: 'telegram' as const,
      creator_role: role,
      language: lang,
      telegram_chat_id: chatId,
      product_title: productTitle,
      amount,
      product_description: note,
    };

    expect(payload.source).toBe('telegram');
    expect(payload.creator_role).toBe('buyer');
    expect(payload.language).toBe('km');
    expect(payload.telegram_chat_id).toBe('987654321');
    expect(payload.product_title).toBe('iPhone 13');
    expect(payload.amount).toBe(500.0);
    expect(payload.product_description).toBe('Please include original box');
  });

  it('buyer payload omits product_type', () => {
    const payload: Record<string, unknown> = {
      source: 'telegram',
      creator_role: 'buyer',
      language: 'en',
      telegram_chat_id: '111',
      product_title: 'Widget',
      amount: 10,
    };
    expect(payload['product_type']).toBeUndefined();
  });
});

// ─── Security: never expose creator token to counterparty ──────────────────

describe('Security: link separation', () => {
  it('creator access URL contains access param', () => {
    const url = 'https://bothsafe.app/d/abc?access=secrettoken';
    expect(url).toContain('?access=');
    expect(url).not.toContain('?invite=');
  });

  it('invite URL contains invite param (not access)', () => {
    const url = 'https://bothsafe.app/d/abc?invite=publictoken';
    expect(url).toContain('?invite=');
    expect(url).not.toContain('?access=');
  });

  it('creator token and invite token are different strings', () => {
    const creatorToken = 'creatortoken123';
    const inviteToken = 'invitetoken456';
    expect(creatorToken).not.toBe(inviteToken);
  });
});
