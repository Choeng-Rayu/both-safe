import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/bothsafe?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/* ── helpers ─────────────────────────────────────────────────────────── */

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function genToken(): string {
  return randomBytes(32).toString('base64url');
}

function genPublicId(): string {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  return Array.from({ length: 10 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3_600_000);

/* ── main ────────────────────────────────────────────────────────────── */

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  /* ── 1. Admin ─────────────────────────────────────────────────────── */
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@bothsafe.app' },
    update: {},
    create: {
      email: 'admin@bothsafe.app',
      passwordHash,
      name: 'System Admin',
      active: true,
    },
  });
  console.log(`Created admin: ${admin.email}`);

  /* ── 2. Registered users ──────────────────────────────────────────── */
  const buyerUser = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      email: 'buyer@example.com',
      passwordHash,
      name: 'Sokha Chan',
      emailVerified: true,
      phone: '+85512345678',
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: 'seller@example.com' },
    update: {},
    create: {
      email: 'seller@example.com',
      passwordHash,
      name: 'Vuthy Lim',
      emailVerified: true,
      phone: '+85587654321',
    },
  });
  console.log(`Created users: ${buyerUser.email}, ${sellerUser.email}`);

  /* ── 3. Telegram identities ───────────────────────────────────────── */
  await prisma.telegramIdentity.upsert({
    where: { chatId: '123456789' },
    update: {},
    create: {
      chatId: '123456789',
      username: 'sokha_buyer',
      firstName: 'Sokha',
      lastName: 'Chan',
      language: 'km',
    },
  });

  await prisma.telegramIdentity.upsert({
    where: { chatId: '987654321' },
    update: {},
    create: {
      chatId: '987654321',
      username: 'vuthy_seller',
      firstName: 'Vuthy',
      lastName: 'Lim',
      language: 'en',
    },
  });
  console.log('Created Telegram identities');

  /* ── 4. Deals ─────────────────────────────────────────────────────── */

  // Helper to create a deal with participants
  async function seedDeal(opts: {
    publicId: string;
    status: string;
    creatorRole: 'buyer' | 'seller';
    amount: number;
    currency?: string;
    createdAt: Date;
    expiresAt?: Date;
    buyerName: string;
    sellerName: string;
    buyerTelegramChatId?: string;
    sellerTelegramChatId?: string;
    productTitle: string;
    productType?: string;
    sellerPayoutKhqr?: string;
    paymentStatus?: 'pending' | 'verified' | 'rejected';
    shipping?: boolean;
    dispute?: { reason: string; message: string; status: string; openedByRole: string };
    ledgerEntries?: Array<{ entryType: string; amount: number; currency: string; reference?: string }>;
    notifications?: Array<{ eventKey: string; channel: string; recipientRef: string; messageKey: string; delivered?: boolean }>;
  }) {
    const creatorToken = genToken();
    const inviteToken = genToken();
    const participantToken = genToken();
    const feePct = 0.05;
    const feeAmount = opts.amount * feePct;
    const netSellerAmount = opts.amount - feeAmount;

    const deal = await prisma.deal.create({
      data: {
        publicId: opts.publicId,
        creatorRole: opts.creatorRole,
        source: 'web',
        status: opts.status,
        currency: opts.currency ?? 'USD',
        amount: opts.amount,
        feeAmount,
        netSellerAmount,
        creatorAccessTokenHash: hashToken(creatorToken),
        inviteTokenHash: hashToken(inviteToken),
        inviteExpiresAt: daysAgo(-7),
        expiresAt: opts.expiresAt ?? daysAgo(-30),
        createdAt: opts.createdAt,
        updatedAt: opts.createdAt,
        product: {
          create: {
            title: opts.productTitle,
            type: opts.productType ?? 'electronics',
            description: 'Sample product description',
            quantity: 1,
          },
        },
        participants: {
          create: [
            {
              role: opts.creatorRole,
              name: opts.creatorRole === 'buyer' ? opts.buyerName : opts.sellerName,
              telegramChatId: opts.creatorRole === 'buyer' ? opts.buyerTelegramChatId : opts.sellerTelegramChatId,
              preferredLanguage: opts.creatorRole === 'buyer' ? 'km' : 'en',
              accessTokenHash: hashToken(creatorToken),
              approvedAt: ['AWAITING_BOTH_APPROVAL', 'READY_FOR_PAYMENT', 'PAYMENT_PENDING_VERIFICATION', 'PAID_ESCROWED', 'SELLER_PREPARING', 'SHIPPED', 'BUYER_CONFIRMED', 'RELEASE_PENDING', 'RELEASED', 'DISPUTED', 'REFUNDED'].includes(opts.status)
                ? hoursAgo(48)
                : null,
              joinedAt: hoursAgo(72),
              createdAt: opts.createdAt,
            },
            {
              role: opts.creatorRole === 'buyer' ? 'seller' : 'buyer',
              name: opts.creatorRole === 'buyer' ? opts.sellerName : opts.buyerName,
              telegramChatId: opts.creatorRole === 'buyer' ? opts.sellerTelegramChatId : opts.buyerTelegramChatId,
              preferredLanguage: opts.creatorRole === 'buyer' ? 'en' : 'km',
              payoutKhqr: opts.sellerPayoutKhqr,
              accessTokenHash: hashToken(participantToken),
              approvedAt: ['READY_FOR_PAYMENT', 'PAYMENT_PENDING_VERIFICATION', 'PAID_ESCROWED', 'SELLER_PREPARING', 'SHIPPED', 'BUYER_CONFIRMED', 'RELEASE_PENDING', 'RELEASED', 'DISPUTED', 'REFUNDED'].includes(opts.status)
                ? hoursAgo(48)
                : null,
              joinedAt: hoursAgo(60),
              createdAt: opts.createdAt,
            },
          ],
        },
        ...(opts.paymentStatus && {
          payments: {
            create: {
              expectedAmount: opts.amount,
              paidAmount: opts.paymentStatus === 'verified' ? opts.amount : null,
              currency: opts.currency ?? 'USD',
              paymentMethod: 'bakong_khqr',
              receiverAccountLabel: 'BothSafe Escrow',
              adminStatus: opts.paymentStatus,
              proofImageUrl: opts.paymentStatus !== 'pending' ? 'https://storage.bothsafe.app/payments/sample-proof.jpg' : null,
              verifiedAt: opts.paymentStatus === 'verified' ? hoursAgo(24) : null,
              createdAt: hoursAgo(36),
            },
          },
        }),
        ...(opts.shipping && {
          shipping: {
            create: {
              deliveryCompany: 'J&T Express',
              trackingNumber: 'JT1234567890KH',
              packagePhotoUrl: 'https://storage.bothsafe.app/shipping/package.jpg',
              sellerNote: 'Package shipped via J&T Express',
              createdAt: hoursAgo(12),
            },
          },
        }),
        ...(opts.dispute && {
          disputes: {
            create: {
              openedByRole: opts.dispute.openedByRole,
              reason: opts.dispute.reason,
              message: opts.dispute.message,
              status: opts.dispute.status,
              evidenceUrls: JSON.stringify(['https://storage.bothsafe.app/disputes/evidence1.jpg']),
              createdAt: hoursAgo(6),
            },
          },
        }),
        ...(opts.ledgerEntries && {
          ledgerEntries: {
            create: opts.ledgerEntries.map((le) => ({
              ...le,
              createdAt: hoursAgo(20),
            })),
          },
        }),
        ...(opts.notifications && {
          notifications: {
            create: opts.notifications.map((n) => ({
              ...n,
              payload: JSON.stringify({ dealPublicId: opts.publicId }),
              createdAt: hoursAgo(40),
            })),
          },
        }),
        auditLogs: {
          create: [
            {
              actorType: 'system',
              action: 'DEAL_CREATED',
              details: JSON.stringify({ source: 'web', creatorRole: opts.creatorRole }),
              createdAt: opts.createdAt,
            },
            {
              actorType: 'participant',
              action: 'COUNTERPARTY_JOINED',
              details: JSON.stringify({ role: opts.creatorRole === 'buyer' ? 'seller' : 'buyer' }),
              createdAt: hoursAgo(60),
            },
            ...(['READY_FOR_PAYMENT', 'PAYMENT_PENDING_VERIFICATION', 'PAID_ESCROWED', 'SELLER_PREPARING', 'SHIPPED', 'BUYER_CONFIRMED', 'RELEASE_PENDING', 'RELEASED', 'DISPUTED', 'REFUNDED'].includes(opts.status)
              ? [{
                  actorType: 'participant',
                  action: 'PARTICIPANT_APPROVED',
                  details: JSON.stringify({ role: 'buyer' }),
                  createdAt: hoursAgo(48),
                },
                {
                  actorType: 'participant',
                  action: 'PARTICIPANT_APPROVED',
                  details: JSON.stringify({ role: 'seller' }),
                  createdAt: hoursAgo(48),
                }]
              : []),
          ],
        },
      },
      include: {
        participants: true,
        product: true,
        payments: true,
        shipping: true,
        disputes: true,
        ledgerEntries: true,
        notifications: true,
        auditLogs: true,
      },
    });

    return { deal, creatorToken, inviteToken, participantToken };
  }

  /* ── Deal 1: DRAFT (buyer created, awaiting counterparty) ──────────── */
  await seedDeal({
    publicId: 'draft-b-001',
    status: 'DRAFT',
    creatorRole: 'buyer',
    amount: 150,
    createdAt: daysAgo(2),
    expiresAt: daysAgo(-28),
    buyerName: 'Sokha Chan',
    sellerName: '',
    buyerTelegramChatId: '123456789',
    productTitle: 'iPhone 14 Case',
    productType: 'accessories',
  });
  console.log('Created deal: DRAFT (draft-b-001)');

  /* ── Deal 2: AWAITING_COUNTERPARTY ─────────────────────────────────── */
  await seedDeal({
    publicId: 'await-c-002',
    status: 'AWAITING_COUNTERPARTY',
    creatorRole: 'seller',
    amount: 450,
    createdAt: daysAgo(3),
    expiresAt: daysAgo(-27),
    buyerName: '',
    sellerName: 'Vuthy Lim',
    sellerTelegramChatId: '987654321',
    productTitle: 'Samsung Galaxy Tablet',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
  });
  console.log('Created deal: AWAITING_COUNTERPARTY (await-c-002)');

  /* ── Deal 3: AWAITING_BOTH_APPROVAL ────────────────────────────────── */
  await seedDeal({
    publicId: 'await-a-003',
    status: 'AWAITING_BOTH_APPROVAL',
    creatorRole: 'buyer',
    amount: 80,
    createdAt: daysAgo(1),
    expiresAt: daysAgo(-29),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'Bluetooth Headphones',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    notifications: [
      { eventKey: 'COUNTERPARTY_JOINED', channel: 'telegram', recipientRef: '123456789', messageKey: 'deal.counterparty_joined', delivered: true },
    ],
  });
  console.log('Created deal: AWAITING_BOTH_APPROVAL (await-a-003)');

  /* ── Deal 4: READY_FOR_PAYMENT ─────────────────────────────────────── */
  await seedDeal({
    publicId: 'ready-p-004',
    status: 'READY_FOR_PAYMENT',
    creatorRole: 'buyer',
    amount: 200,
    currency: 'USD',
    createdAt: daysAgo(2),
    expiresAt: daysAgo(-28),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'Nike Running Shoes',
    productType: 'fashion',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    notifications: [
      { eventKey: 'COUNTERPARTY_JOINED', channel: 'telegram', recipientRef: '123456789', messageKey: 'deal.counterparty_joined', delivered: true },
      { eventKey: 'BOTH_APPROVED', channel: 'telegram', recipientRef: '987654321', messageKey: 'deal.both_approved', delivered: true },
    ],
  });
  console.log('Created deal: READY_FOR_PAYMENT (ready-p-004)');

  /* ── Deal 5: PAYMENT_PENDING_VERIFICATION ──────────────────────────── */
  await seedDeal({
    publicId: 'pay-pend-005',
    status: 'PAYMENT_PENDING_VERIFICATION',
    creatorRole: 'buyer',
    amount: 500,
    currency: 'USD',
    createdAt: daysAgo(4),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'MacBook Air M2',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    paymentStatus: 'pending',
    notifications: [
      { eventKey: 'PAYMENT_PROOF_UPLOADED', channel: 'telegram', recipientRef: '987654321', messageKey: 'payment.proof_uploaded', delivered: true },
    ],
  });
  console.log('Created deal: PAYMENT_PENDING_VERIFICATION (pay-pend-005)');

  /* ── Deal 6: PAID_ESCROWED ─────────────────────────────────────────── */
  await seedDeal({
    publicId: 'paid-e-006',
    status: 'PAID_ESCROWED',
    creatorRole: 'buyer',
    amount: 320,
    currency: 'USD',
    createdAt: daysAgo(5),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'iPad Mini 6',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    paymentStatus: 'verified',
    ledgerEntries: [
      { entryType: 'ESCROW_RECEIVED', amount: 320, currency: 'USD', reference: 'bakong-tx-abc123' },
      { entryType: 'PLATFORM_FEE_RESERVED', amount: 16, currency: 'USD', reference: 'fee-calc-001' },
    ],
    notifications: [
      { eventKey: 'PAYMENT_VERIFIED', channel: 'telegram', recipientRef: '987654321', messageKey: 'payment.verified', delivered: true },
      { eventKey: 'SELLER_SHOULD_SHIP', channel: 'telegram', recipientRef: '987654321', messageKey: 'seller.should_ship', delivered: true },
    ],
  });
  console.log('Created deal: PAID_ESCROWED (paid-e-006)');

  /* ── Deal 7: SHIPPED ───────────────────────────────────────────────── */
  await seedDeal({
    publicId: 'ship-007',
    status: 'SHIPPED',
    creatorRole: 'buyer',
    amount: 75,
    currency: 'USD',
    createdAt: daysAgo(6),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'Wireless Mouse',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    paymentStatus: 'verified',
    shipping: true,
    ledgerEntries: [
      { entryType: 'ESCROW_RECEIVED', amount: 75, currency: 'USD', reference: 'bakong-tx-def456' },
      { entryType: 'PLATFORM_FEE_RESERVED', amount: 3.75, currency: 'USD', reference: 'fee-calc-002' },
    ],
    notifications: [
      { eventKey: 'SHIPPING_UPLOADED', channel: 'telegram', recipientRef: '123456789', messageKey: 'shipping.uploaded', delivered: true },
    ],
  });
  console.log('Created deal: SHIPPED (ship-007)');

  /* ── Deal 8: RELEASE_PENDING ───────────────────────────────────────── */
  await seedDeal({
    publicId: 'rel-pend-008',
    status: 'RELEASE_PENDING',
    creatorRole: 'buyer',
    amount: 120,
    currency: 'USD',
    createdAt: daysAgo(7),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'Mechanical Keyboard',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    paymentStatus: 'verified',
    shipping: true,
    ledgerEntries: [
      { entryType: 'ESCROW_RECEIVED', amount: 120, currency: 'USD', reference: 'bakong-tx-ghi789' },
      { entryType: 'PLATFORM_FEE_RESERVED', amount: 6, currency: 'USD', reference: 'fee-calc-003' },
      { entryType: 'SELLER_PAYOUT_PENDING', amount: 114, currency: 'USD', reference: 'payout-pending-001' },
    ],
    notifications: [
      { eventKey: 'BUYER_CONFIRMED', channel: 'telegram', recipientRef: '987654321', messageKey: 'buyer.confirmed', delivered: true },
    ],
  });
  console.log('Created deal: RELEASE_PENDING (rel-pend-008)');

  /* ── Deal 9: RELEASED ──────────────────────────────────────────────── */
  await seedDeal({
    publicId: 'rel-009',
    status: 'RELEASED',
    creatorRole: 'seller',
    amount: 250,
    currency: 'USD',
    createdAt: daysAgo(10),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'Sony WH-1000XM5',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    paymentStatus: 'verified',
    shipping: true,
    ledgerEntries: [
      { entryType: 'ESCROW_RECEIVED', amount: 250, currency: 'USD', reference: 'bakong-tx-jkl012' },
      { entryType: 'PLATFORM_FEE_RESERVED', amount: 12.5, currency: 'USD', reference: 'fee-calc-004' },
      { entryType: 'SELLER_PAYOUT_PENDING', amount: 237.5, currency: 'USD', reference: 'payout-pending-002' },
      { entryType: 'SELLER_PAYOUT_SENT', amount: 237.5, currency: 'USD', reference: 'payout-sent-002' },
    ],
    notifications: [
      { eventKey: 'PAYOUT_RELEASED', channel: 'telegram', recipientRef: '987654321', messageKey: 'payout.released', delivered: true },
    ],
  });
  console.log('Created deal: RELEASED (rel-009)');

  /* ── Deal 10: DISPUTED ─────────────────────────────────────────────── */
  await seedDeal({
    publicId: 'disp-010',
    status: 'DISPUTED',
    creatorRole: 'buyer',
    amount: 180,
    currency: 'USD',
    createdAt: daysAgo(8),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'Refurbished Laptop',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    paymentStatus: 'verified',
    shipping: true,
    dispute: {
      reason: 'DAMAGED_ITEM',
      message: 'The laptop arrived with a cracked screen. I need a refund.',
      status: 'open',
      openedByRole: 'buyer',
    },
    ledgerEntries: [
      { entryType: 'ESCROW_RECEIVED', amount: 180, currency: 'USD', reference: 'bakong-tx-mno345' },
      { entryType: 'PLATFORM_FEE_RESERVED', amount: 9, currency: 'USD', reference: 'fee-calc-005' },
    ],
    notifications: [
      { eventKey: 'DISPUTE_OPENED', channel: 'telegram', recipientRef: '987654321', messageKey: 'dispute.opened', delivered: true },
    ],
  });
  console.log('Created deal: DISPUTED (disp-010)');

  /* ── Deal 11: REFUNDED ─────────────────────────────────────────────── */
  await seedDeal({
    publicId: 'ref-011',
    status: 'REFUNDED',
    creatorRole: 'buyer',
    amount: 95,
    currency: 'USD',
    createdAt: daysAgo(12),
    buyerName: 'Sokha Chan',
    sellerName: 'Vuthy Lim',
    buyerTelegramChatId: '123456789',
    sellerTelegramChatId: '987654321',
    productTitle: 'Smart Watch',
    productType: 'electronics',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    paymentStatus: 'verified',
    shipping: true,
    dispute: {
      reason: 'FAKE_ITEM',
      message: 'This is a counterfeit product. Not authentic.',
      status: 'resolved_refund',
      openedByRole: 'buyer',
    },
    ledgerEntries: [
      { entryType: 'ESCROW_RECEIVED', amount: 95, currency: 'USD', reference: 'bakong-tx-pqr678' },
      { entryType: 'PLATFORM_FEE_RESERVED', amount: 4.75, currency: 'USD', reference: 'fee-calc-006' },
      { entryType: 'BUYER_REFUND_PENDING', amount: 95, currency: 'USD', reference: 'refund-pending-001' },
      { entryType: 'BUYER_REFUND_SENT', amount: 95, currency: 'USD', reference: 'refund-sent-001' },
    ],
    notifications: [
      { eventKey: 'REFUND_COMPLETED', channel: 'telegram', recipientRef: '123456789', messageKey: 'refund.completed', delivered: true },
    ],
  });
  console.log('Created deal: REFUNDED (ref-011)');

  /* ── Deal 12: EXPIRED ──────────────────────────────────────────────── */
  await seedDeal({
    publicId: 'exp-012',
    status: 'EXPIRED',
    creatorRole: 'seller',
    amount: 60,
    currency: 'USD',
    createdAt: daysAgo(35),
    expiresAt: daysAgo(5),
    buyerName: '',
    sellerName: 'Vuthy Lim',
    sellerTelegramChatId: '987654321',
    productTitle: 'Phone Charger',
    productType: 'accessories',
    sellerPayoutKhqr: 'vuthy.lim@bakong',
    notifications: [],
  });
  console.log('Created deal: EXPIRED (exp-012)');

  /* ── 5. Stored files ──────────────────────────────────────────────── */
  await prisma.storedFile.createMany({
    data: [
      {
        category: 'product',
        mimeType: 'image/jpeg',
        sizeBytes: 1_234_567,
        storageKey: 'products/iphone-case.jpg',
        isPublic: true,
        uploadedBy: 'seller',
      },
      {
        category: 'payment_proof',
        mimeType: 'image/png',
        sizeBytes: 2_345_678,
        storageKey: 'payments/bakong-screenshot.png',
        isPublic: false,
        uploadedBy: 'buyer',
      },
      {
        category: 'package_photo',
        mimeType: 'image/jpeg',
        sizeBytes: 3_456_789,
        storageKey: 'shipping/package-photo.jpg',
        isPublic: false,
        uploadedBy: 'seller',
      },
      {
        category: 'dispute_evidence',
        mimeType: 'image/jpeg',
        sizeBytes: 1_876_543,
        storageKey: 'disputes/cracked-screen.jpg',
        isPublic: false,
        uploadedBy: 'buyer',
      },
    ],
    skipDuplicates: true,
  });
  console.log('Created stored files');

  console.log('\nDatabase seeded successfully!');
  console.log('Summary:');
  console.log('  - 1 admin user');
  console.log('  - 2 registered users');
  console.log('  - 2 Telegram identities');
  console.log('  - 12 sample deals across all statuses');
  console.log('  - Payments, shipping proofs, disputes, ledger entries');
  console.log('  - Audit logs and notifications');
  console.log('  - Stored file metadata');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
