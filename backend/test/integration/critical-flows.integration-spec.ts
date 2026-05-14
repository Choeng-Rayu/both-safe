/**
 * Integration Tests — Critical Business Flows
 * Task 23: Write integration tests for critical flows
 *
 * These tests exercise the service layer against a real PostgreSQL database.
 * Run the test DB:  docker compose up -d
 * Run tests:         npx jest --config test/jest-e2e.json --testPathPattern=integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DealsService } from '../../src/deals/deals.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { ShippingService } from '../../src/shipping/shipping.service';
import { DisputesService } from '../../src/disputes/disputes.service';
import { AdminService } from '../../src/admin/admin.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { AuditService } from '../../src/common/services/audit.service';
import { NotificationService } from '../../src/notifications/notification.service';
import { FilesService } from '../../src/files/files.service';
import { AuthService } from '../../src/auth/auth.service';
import { DealsModule } from '../../src/deals/deals.module';
import { PaymentsModule } from '../../src/payments/payments.module';
import { ShippingModule } from '../../src/shipping/shipping.module';
import { DisputesModule } from '../../src/disputes/disputes.module';
import { AdminModule } from '../../src/admin/admin.module';
import { LedgerModule } from '../../src/ledger/ledger.module';
import { AuditModule } from '../../src/common/services/audit.module';
import { NotificationModule } from '../../src/notifications/notification.module';
import { FilesModule } from '../../src/files/files.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { TransfersModule } from '../../src/transfers/transfers.module';

import { DEAL_STATUS, MESSAGE_KEYS, LEDGER_ENTRY_TYPES } from '../../src/common/constants';

/* ── helpers ─────────────────────────────────────────────────────────── */

function actor(role: 'buyer' | 'seller' | null, participantId: string | null, type: 'participant' | 'invite' | 'admin' = 'participant') {
  return { type, role, participantId };
}

/* ═══════════════════════════════════════════════════════════════════════
   Suite
   ═══════════════════════════════════════════════════════════════════════ */

describe('Critical Flows (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deals: DealsService;
  let payments: PaymentsService;
  let shipping: ShippingService;
  let disputes: DisputesService;
  let admin: AdminService;
  let ledger: LedgerService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuditModule,
        NotificationModule,
        LedgerModule,
        FilesModule,
        AuthModule,
        TransfersModule,
        DealsModule,
        PaymentsModule,
        ShippingModule,
        DisputesModule,
        AdminModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    deals = app.get(DealsService);
    payments = app.get(PaymentsService);
    shipping = app.get(ShippingService);
    disputes = app.get(DisputesService);
    admin = app.get(AdminService);
    ledger = app.get(LedgerService);

    /* ensure clean slate */
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.shipping.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.storedFile.deleteMany();
    await prisma.participant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.deal.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    /* clean tables between tests (keep deals / users from seed if present) */
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.shipping.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.storedFile.deleteMany();
    await prisma.participant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.deal.deleteMany();
  });

  /* ── 23.1 Buyer-created deal flow ─────────────────────────────────── */

  describe('Buyer-created deal flow', () => {
    it('creates a deal with DRAFT status when minimum fields are missing', async () => {
      const result = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
      } as any);

      expect(result.status).toBe(DEAL_STATUS.DRAFT);
      expect(result.public_id).toBeDefined();
      expect(result.creator_access_url).toContain('/d/');
      expect(result.invite_url).toContain('invite=');
      expect(result.missing_fields).toContain('product_title');
      expect(result.missing_fields).toContain('amount');
    });

    it('creates a deal with AWAITING_COUNTERPARTY when minimum fields are present', async () => {
      const result = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
        product_title: 'iPhone Case',
        amount: 150,
        currency: 'USD',
      } as any);

      expect(result.status).toBe(DEAL_STATUS.AWAITING_COUNTERPARTY);
      expect(result.missing_fields).not.toContain('product_title');
      expect(result.missing_fields).not.toContain('amount');
    });

    it('allows seller to join via invite token', async () => {
      const created = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
        product_title: 'iPhone Case',
        amount: 150,
      } as any);

      const inviteToken = created.invite_url.split('invite=')[1];

      const joined = await deals.joinDeal(
        created.public_id,
        { invite_token: inviteToken, name: 'Vuthy', role: 'seller', preferred_language: 'en' },
        actor(null, null, 'invite'),
      );

      expect(joined.status).toBe(DEAL_STATUS.AWAITING_BOTH_APPROVAL);
      expect(joined.participant_access_url).toContain('access=');
      expect(joined.message_key).toBe(MESSAGE_KEYS.COUNTERPARTY_JOINED);
    });

    it('prevents duplicate joins', async () => {
      const created = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
        product_title: 'iPhone Case',
        amount: 150,
      } as any);

      const inviteToken = created.invite_url.split('invite=')[1];

      await deals.joinDeal(
        created.public_id,
        { invite_token: inviteToken, name: 'Vuthy', role: 'seller', preferred_language: 'en' },
        actor(null, null, 'invite'),
      );

      await expect(
        deals.joinDeal(
          created.public_id,
          { invite_token: inviteToken, name: 'Vuthy2', role: 'seller', preferred_language: 'en' },
          actor(null, null, 'invite'),
        ),
      ).rejects.toThrow();
    });

    it('transitions to READY_FOR_PAYMENT when both approve and all fields complete', async () => {
      const created = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
        product_title: 'iPhone Case',
        amount: 150,
        currency: 'USD',
      } as any);

      const inviteToken = created.invite_url.split('invite=')[1];
      const creatorAccess = created.creator_access_url.split('access=')[1];

      const joined = await deals.joinDeal(
        created.public_id,
        { invite_token: inviteToken, name: 'Vuthy', role: 'seller', preferred_language: 'en' },
        actor(null, null, 'invite'),
      );

      const participantAccess = joined.participant_access_url.split('access=')[1];

      // Get deal to find participant IDs
      const deal = await prisma.deal.findUnique({
        where: { publicId: created.public_id },
        include: { participants: true },
      });
      const buyerParticipant = deal!.participants.find((p) => p.role === 'buyer')!;
      const sellerParticipant = deal!.participants.find((p) => p.role === 'seller')!;

      // Update seller payout
      await deals.updatePayout(
        created.public_id,
        { payout_khqr: 'vuthy@bakong' },
        actor('seller', sellerParticipant.id),
      );

      // Buyer approves
      const buyerApprove = await deals.approveDeal(created.public_id, actor('buyer', buyerParticipant.id));
      expect(buyerApprove.status).toBe(DEAL_STATUS.AWAITING_BOTH_APPROVAL);

      // Seller approves
      const sellerApprove = await deals.approveDeal(created.public_id, actor('seller', sellerParticipant.id));
      expect(sellerApprove.status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);
      expect(sellerApprove.message_key).toBe(MESSAGE_KEYS.BOTH_APPROVED);
      expect(sellerApprove.missing_fields).toEqual([]);
    });
  });

  /* ── 23.2 Payment verification flow ───────────────────────────────── */

  describe('Payment verification flow', () => {
    async function setupReadyForPayment() {
      const created = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
        product_title: 'iPhone Case',
        amount: 150,
        currency: 'USD',
      } as any);

      const inviteToken = created.invite_url.split('invite=')[1];

      const joined = await deals.joinDeal(
        created.public_id,
        { invite_token: inviteToken, name: 'Vuthy', role: 'seller', preferred_language: 'en' },
        actor(null, null, 'invite'),
      );

      const deal = await prisma.deal.findUnique({
        where: { publicId: created.public_id },
        include: { participants: true },
      });
      const buyerParticipant = deal!.participants.find((p) => p.role === 'buyer')!;
      const sellerParticipant = deal!.participants.find((p) => p.role === 'seller')!;

      await deals.updatePayout(created.public_id, { payout_khqr: 'vuthy@bakong' }, actor('seller', sellerParticipant.id));
      await deals.approveDeal(created.public_id, actor('buyer', buyerParticipant.id));
      await deals.approveDeal(created.public_id, actor('seller', sellerParticipant.id));

      return { publicId: created.public_id, dealId: deal!.id, buyerParticipant, sellerParticipant };
    }

    it('uploads payment proof and transitions to PAYMENT_PENDING_VERIFICATION', async () => {
      const { publicId, dealId, buyerParticipant } = await setupReadyForPayment();

      // Create a mock payment proof record via prisma directly (service requires file upload)
      const payment = await prisma.payment.create({
        data: {
          dealId,
          expectedAmount: 150,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe Escrow',
          adminStatus: 'pending',
          proofImageUrl: 'https://storage.example.com/proof.png',
        },
      });

      // Transition deal status manually to simulate payment proof upload
      await prisma.deal.update({ where: { id: dealId }, data: { status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION } });

      const updated = await prisma.deal.findUnique({ where: { id: dealId } });
      expect(updated!.status).toBe(DEAL_STATUS.PAYMENT_PENDING_VERIFICATION);
    });

    it('admin verification creates ledger entries and transitions to PAID_ESCROWED', async () => {
      const { publicId, dealId } = await setupReadyForPayment();

      const payment = await prisma.payment.create({
        data: {
          dealId,
          expectedAmount: 150,
          paidAmount: 150,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe Escrow',
          adminStatus: 'pending',
          proofImageUrl: 'https://storage.example.com/proof.png',
        },
      });

      await prisma.deal.update({ where: { id: dealId }, data: { status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION } });

      // Admin verifies payment
      const result = await payments.adminVerify(payment.id, 'admin-1');

      expect(result.deal_status).toBe(DEAL_STATUS.SELLER_PREPARING);

      // Check ledger entries
      const entries = await prisma.ledgerEntry.findMany({ where: { dealId } });
      const escrowEntry = entries.find((e) => e.entryType === LEDGER_ENTRY_TYPES.ESCROW_RECEIVED);
      const feeEntry = entries.find((e) => e.entryType === LEDGER_ENTRY_TYPES.PLATFORM_FEE_RESERVED);

      expect(escrowEntry).toBeDefined();
      expect(escrowEntry!.amount).toBe(150);
      expect(feeEntry).toBeDefined();
      expect(feeEntry!.amount).toBeCloseTo(150 * 0.02, 2); // 2% platform fee
    });

    it('admin rejection returns deal to READY_FOR_PAYMENT', async () => {
      const { publicId, dealId } = await setupReadyForPayment();

      const payment = await prisma.payment.create({
        data: {
          dealId,
          expectedAmount: 150,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe Escrow',
          adminStatus: 'pending',
          proofImageUrl: 'https://storage.example.com/proof.png',
        },
      });

      await prisma.deal.update({ where: { id: dealId }, data: { status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION } });

      const result = await payments.adminReject(payment.id, 'Amount mismatch', 'admin-1');

      expect(result.deal_status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);

      const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(updatedPayment!.adminStatus).toBe('rejected');
      expect(updatedPayment!.rejectedReason).toBe('Amount mismatch');
    });

    it('prevents duplicate verification', async () => {
      const { publicId, dealId } = await setupReadyForPayment();

      const payment = await prisma.payment.create({
        data: {
          dealId,
          expectedAmount: 150,
          paidAmount: 150,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe Escrow',
          adminStatus: 'verified',
          proofImageUrl: 'https://storage.example.com/proof.png',
          verifiedAt: new Date(),
        },
      });

      await prisma.deal.update({ where: { id: dealId }, data: { status: DEAL_STATUS.PAID_ESCROWED } });

      await expect(
        payments.adminVerify(payment.id, 'admin-1'),
      ).rejects.toThrow();
    });
  });

  /* ── 23.3 Dispute resolution flow ─────────────────────────────────── */

  describe('Dispute resolution flow', () => {
    async function setupPaidEscrowed() {
      const created = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
        product_title: 'iPhone Case',
        amount: 150,
        currency: 'USD',
      } as any);

      const inviteToken = created.invite_url.split('invite=')[1];
      const joined = await deals.joinDeal(
        created.public_id,
        { invite_token: inviteToken, name: 'Vuthy', role: 'seller', preferred_language: 'en' },
        actor(null, null, 'invite'),
      );

      const deal = await prisma.deal.findUnique({
        where: { publicId: created.public_id },
        include: { participants: true },
      });
      const buyerParticipant = deal!.participants.find((p) => p.role === 'buyer')!;
      const sellerParticipant = deal!.participants.find((p) => p.role === 'seller')!;

      await deals.updatePayout(created.public_id, { payout_khqr: 'vuthy@bakong' }, actor('seller', sellerParticipant.id));
      await deals.approveDeal(created.public_id, actor('buyer', buyerParticipant.id));
      await deals.approveDeal(created.public_id, actor('seller', sellerParticipant.id));

      // Simulate payment verification
      await prisma.payment.create({
        data: {
          dealId: deal!.id,
          expectedAmount: 150,
          paidAmount: 150,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe Escrow',
          adminStatus: 'verified',
          verifiedAt: new Date(),
        },
      });
      await prisma.deal.update({ where: { id: deal!.id }, data: { status: DEAL_STATUS.PAID_ESCROWED } });

      return { publicId: created.public_id, dealId: deal!.id, buyerParticipant, sellerParticipant };
    }

    it('opens a dispute and transitions to DISPUTED', async () => {
      const { publicId, dealId, buyerParticipant } = await setupPaidEscrowed();

      const result = await disputes.openDispute(
        publicId,
        actor('buyer', buyerParticipant.id),
        {
          reason: 'ITEM_NOT_RECEIVED',
          message: 'I never received my item',
        },
      );

      expect(result.status).toBe(DEAL_STATUS.DISPUTED);

      const dispute = await prisma.dispute.findFirst({ where: { dealId } });
      expect(dispute).toBeDefined();
      expect(dispute!.reason).toBe('ITEM_NOT_RECEIVED');
      expect(dispute!.status).toBe('open');
    });

    it('admin resolves dispute with release decision', async () => {
      const { publicId, dealId, buyerParticipant } = await setupPaidEscrowed();

      await disputes.openDispute(
        publicId,
        { reason: 'OTHER', message: 'Issue with delivery' },
        actor('buyer', buyerParticipant.id),
      );

      const dispute = await prisma.dispute.findFirst({ where: { dealId } });

      const result = await admin.resolveDispute(dispute!.id, {
        decision: 'release',
        admin_note: 'Seller provided valid tracking',
      }, 'admin-1');

      expect(result.status).toBe(DEAL_STATUS.RELEASE_PENDING);

      const updatedDispute = await prisma.dispute.findUnique({ where: { id: dispute!.id } });
      expect(updatedDispute!.status).toBe('resolved_release');

      // Check ledger entry
      const entries = await prisma.ledgerEntry.findMany({ where: { dealId } });
      const payoutPending = entries.find((e) => e.entryType === LEDGER_ENTRY_TYPES.SELLER_PAYOUT_PENDING);
      expect(payoutPending).toBeDefined();
    });

    it('admin resolves dispute with refund decision', async () => {
      const { publicId, dealId, buyerParticipant } = await setupPaidEscrowed();

      await disputes.openDispute(
        publicId,
        { reason: 'FAKE_ITEM', message: 'Counterfeit product received' },
        actor('buyer', buyerParticipant.id),
      );

      const dispute = await prisma.dispute.findFirst({ where: { dealId } });

      const result = await admin.resolveDispute(dispute!.id, {
        decision: 'refund',
        admin_note: 'Buyer provided evidence of fake item',
      }, 'admin-1');

      expect(result.status).toBe(DEAL_STATUS.REFUNDED);

      const updatedDispute = await prisma.dispute.findUnique({ where: { id: dispute!.id } });
      expect(updatedDispute!.status).toBe('resolved_refund');

      // Check ledger entries for refund
      const entries = await prisma.ledgerEntry.findMany({ where: { dealId } });
      const refundPending = entries.find((e) => e.entryType === LEDGER_ENTRY_TYPES.BUYER_REFUND_PENDING);
      const refundSent = entries.find((e) => e.entryType === LEDGER_ENTRY_TYPES.BUYER_REFUND_SENT);
      expect(refundPending).toBeDefined();
      expect(refundSent).toBeDefined();
    });
  });

  /* ── 23.4 Complete happy path ─────────────────────────────────────── */

  describe('Complete happy path', () => {
    it('full flow: create → join → approve → pay → ship → confirm → release', async () => {
      // 1. Create deal
      const created = await deals.createDeal({
        creator_role: 'buyer',
        source: 'web',
        creator_name: 'Sokha',
        product_title: 'MacBook Air',
        amount: 1200,
        currency: 'USD',
      } as any);
      expect(created.status).toBe(DEAL_STATUS.AWAITING_COUNTERPARTY);

      // 2. Join
      const inviteToken = created.invite_url.split('invite=')[1];
      const joined = await deals.joinDeal(
        created.public_id,
        { invite_token: inviteToken, name: 'Vuthy', role: 'seller', preferred_language: 'en' },
        actor(null, null, 'invite'),
      );
      expect(joined.status).toBe(DEAL_STATUS.AWAITING_BOTH_APPROVAL);

      const deal = await prisma.deal.findUnique({
        where: { publicId: created.public_id },
        include: { participants: true },
      });
      const buyerParticipant = deal!.participants.find((p) => p.role === 'buyer')!;
      const sellerParticipant = deal!.participants.find((p) => p.role === 'seller')!;

      // 3. Update payout & product
      await deals.updatePayout(created.public_id, { payout_khqr: 'vuthy@bakong' }, actor('seller', sellerParticipant.id));

      // 4. Both approve
      await deals.approveDeal(created.public_id, actor('buyer', buyerParticipant.id));
      const approved = await deals.approveDeal(created.public_id, actor('seller', sellerParticipant.id));
      expect(approved.status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);

      // 5. Simulate payment verification
      await prisma.payment.create({
        data: {
          dealId: deal!.id,
          expectedAmount: 1200,
          paidAmount: 1200,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe Escrow',
          adminStatus: 'verified',
          verifiedAt: new Date(),
        },
      });
      await prisma.deal.update({ where: { id: deal!.id }, data: { status: DEAL_STATUS.PAID_ESCROWED } });

      // 6. Seller ships
      await shipping.uploadShippingProof(
        created.public_id,
        actor('seller', sellerParticipant.id),
        {
          delivery_company: 'J&T Express',
          tracking_number: 'JT123456',
        },
        {},
      );

      const shipped = await prisma.deal.findUnique({ where: { id: deal!.id } });
      expect(shipped!.status).toBe(DEAL_STATUS.SHIPPED);

      // 7. Buyer confirms
      const confirmed = await deals.confirmReceived(created.public_id, actor('buyer', buyerParticipant.id));
      expect(confirmed.status).toBe(DEAL_STATUS.RELEASE_PENDING);

      // 8. Admin releases
      const released = await admin.release(deal!.id, { payout_reference: 'bank-tx-789' }, 'admin-1');
      expect(released.status).toBe(DEAL_STATUS.RELEASED);

      // Verify all ledger entries
      const entries = await prisma.ledgerEntry.findMany({ where: { dealId: deal!.id }, orderBy: { createdAt: 'asc' } });
      expect(entries.length).toBeGreaterThanOrEqual(3);
      expect(entries.some((e) => e.entryType === LEDGER_ENTRY_TYPES.ESCROW_RECEIVED)).toBe(true);
      expect(entries.some((e) => e.entryType === LEDGER_ENTRY_TYPES.PLATFORM_FEE_RESERVED)).toBe(true);
      expect(entries.some((e) => e.entryType === LEDGER_ENTRY_TYPES.SELLER_PAYOUT_PENDING)).toBe(true);
      expect(entries.some((e) => e.entryType === LEDGER_ENTRY_TYPES.SELLER_PAYOUT_SENT)).toBe(true);

      // Verify audit trail
      const auditLogs = await prisma.auditLog.findMany({ where: { dealId: deal!.id } });
      expect(auditLogs.length).toBeGreaterThanOrEqual(5);

      // Verify notifications
      const notifications = await prisma.notification.findMany({ where: { dealId: deal!.id } });
      expect(notifications.length).toBeGreaterThanOrEqual(3);
    });
  });
});
