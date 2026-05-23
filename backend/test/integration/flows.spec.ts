import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DealsService } from '../../src/deals/deals.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { ShippingService } from '../../src/shipping/shipping.service';
import { DisputesService } from '../../src/disputes/disputes.service';
import { AdminService } from '../../src/admin/admin.service';
import { LedgerService } from '../../src/ledger/ledger.service';
import { FilesService } from '../../src/files/files.service';
import { NotificationService } from '../../src/notifications/notification.service';
import { AuditService } from '../../src/common/services/audit.service';
import { DEAL_STATUS } from '../../src/common/constants';
import {
  cleanDatabase,
  createMockFilesService,
  createMockNotificationService,
  createMockAuditService,
  createAdminAndToken,
  createTestDeal,
  joinDealAsCounterparty,
} from '../test-utils';

describe('Integration: Critical Flows', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let jwt: JwtService;
  let deals: DealsService;
  let payments: PaymentsService;
  let shipping: ShippingService;
  let disputes: DisputesService;
  let admin: AdminService;
  let ledger: LedgerService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        PrismaService,
        DealsService,
        PaymentsService,
        ShippingService,
        DisputesService,
        AdminService,
        LedgerService,
        { provide: FilesService, useValue: createMockFilesService() },
        {
          provide: NotificationService,
          useValue: createMockNotificationService(),
        },
        { provide: AuditService, useValue: createMockAuditService() },
      ],
    }).compile();

    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
    deals = module.get(DealsService);
    payments = module.get(PaymentsService);
    shipping = module.get(ShippingService);
    disputes = module.get(DisputesService);
    admin = module.get(AdminService);
    ledger = module.get(LedgerService);

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ─── Task 23.1: Buyer-created deal flow ──────────────────────────────────
  describe('Deal Creation & Join Flow', () => {
    it('buyer creates deal → seller joins → both approve → READY_FOR_PAYMENT', async () => {
      // Step 1: Create deal as buyer
      const created = await deals.createDeal(
        {
          source: 'web',
          creator_role: 'buyer',
          language: 'en',
          product_title: 'iPhone 15',
          product_type: 'electronics',
          amount: 500,
          currency: 'USD',
          creator_name: 'Alice',
          creator_phone: '+85511111111',
        } as any,
        null,
      );

      expect(created.status).toBe(DEAL_STATUS.AWAITING_COUNTERPARTY);
      expect(created.missing_fields).toContain('seller');
      expect(created.public_id).toBeDefined();

      const publicId = created.public_id;
      const inviteToken = new URL(created.invite_url).searchParams.get(
        'invite',
      )!;

      // Step 2: Seller joins via invite token
      const joined = await deals.joinDeal(
        publicId,
        {
          invite_token: inviteToken,
          role: 'seller',
          name: 'Bob',
          phone: '+85522222222',
          preferred_language: 'en',
        } as any,
        { type: 'invite', role: null } as any,
        null,
      );

      expect(joined.status).toBe(DEAL_STATUS.AWAITING_BOTH_APPROVAL);

      // Step 3: Seller adds payout info
      const sellerParticipant = await prisma.participant.findFirst({
        where: { dealId: joined.deal_id, role: 'seller' },
      });

      await deals.updatePayout(
        publicId,
        {
          payout_khqr: 'bob@aba',
          payout_bank_name: 'ABA',
          payout_account_name: 'Bob',
          payout_account_number: '123456',
        } as any,
        {
          type: 'participant',
          role: 'seller',
          participantId: sellerParticipant!.id,
        } as any,
      );

      // Step 4: Both approve
      await deals.approveDeal(publicId, {
        type: 'participant',
        role: 'seller',
        participantId: sellerParticipant!.id,
      } as any);

      const buyerParticipant = await prisma.participant.findFirst({
        where: { dealId: joined.deal_id, role: 'buyer' },
      });

      const approved = await deals.approveDeal(publicId, {
        type: 'participant',
        role: 'buyer',
        participantId: buyerParticipant!.id,
      } as any);

      expect(approved.status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);
      expect(approved.message_key).toBe('deal.both_approved');
    });

    it('seller creates deal → buyer joins → both approve → READY_FOR_PAYMENT', async () => {
      const created = await deals.createDeal(
        {
          source: 'web',
          creator_role: 'seller',
          language: 'en',
          product_title: 'MacBook Pro',
          product_type: 'electronics',
          amount: 1200,
          currency: 'USD',
          creator_name: 'Carol',
          creator_phone: '+85533333333',
        } as any,
        null,
      );

      expect(created.status).toBe(DEAL_STATUS.AWAITING_COUNTERPARTY);

      const publicId = created.public_id;
      const inviteToken = new URL(created.invite_url).searchParams.get(
        'invite',
      )!;

      const joined = await deals.joinDeal(
        publicId,
        {
          invite_token: inviteToken,
          role: 'buyer',
          name: 'Dave',
          preferred_language: 'en',
        } as any,
        { type: 'invite', role: null } as any,
        null,
      );

      expect(joined.status).toBe(DEAL_STATUS.AWAITING_BOTH_APPROVAL);

      const dealAfterJoin = await prisma.deal.findUnique({
        where: { publicId },
        include: { participants: true },
      });
      const sellerP = dealAfterJoin!.participants.find(
        (p) => p.role === 'seller',
      )!;
      const buyerP = dealAfterJoin!.participants.find(
        (p) => p.role === 'buyer',
      )!;

      // Add payout as seller
      await deals.updatePayout(
        publicId,
        {
          payout_khqr: 'carol@aba',
          payout_bank_name: 'ABA',
          payout_account_name: 'Carol',
          payout_account_number: '123456',
        } as any,
        {
          type: 'participant',
          role: 'seller',
          participantId: sellerP.id,
        } as any,
      );

      await deals.approveDeal(publicId, {
        type: 'participant',
        role: 'seller',
        participantId: sellerP.id,
      } as any);
      const approved = await deals.approveDeal(publicId, {
        type: 'participant',
        role: 'buyer',
        participantId: buyerP.id,
      } as any);

      expect(approved.status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);
    });
  });

  // ─── Task 23.2: Payment verification flow ────────────────────────────────
  describe('Payment Verification Flow', () => {
    it('buyer uploads payment proof → admin verifies → PAID_ESCROWED → SELLER_PREPARING', async () => {
      const { deal, publicId, creatorParticipant } = await createTestDeal(
        prisma,
        {
          creatorRole: 'seller',
          status: DEAL_STATUS.READY_FOR_PAYMENT,
        },
      );

      const { participant: buyer } = await joinDealAsCounterparty(
        prisma,
        deal.id,
        'buyer',
        'Alice',
      );
      await prisma.participant.updateMany({
        where: { dealId: deal.id },
        data: { approvedAt: new Date() },
      });

      // Buyer uploads payment proof
      const uploaded = await payments.uploadProof(
        publicId,
        undefined,
        { paid_amount: 100, buyer_note: 'Sent via Bakong' },
        { type: 'participant', role: 'buyer', participantId: buyer.id } as any,
      );

      expect(uploaded.status).toBe(DEAL_STATUS.PAYMENT_PENDING_VERIFICATION);

      // Admin verifies
      const payment = await prisma.payment.findFirst({
        where: { dealId: deal.id },
      });
      const { admin: adminUser } = await createAdminAndToken(prisma, jwt);

      const verified = await payments.adminVerify(payment!.id, adminUser.id);
      expect(verified.deal_status).toBe(DEAL_STATUS.SELLER_PREPARING);

      // Check ledger entries
      const entries = await ledger.list(deal.id);
      const escrowEntry = entries.find(
        (e) => e.entryType === 'ESCROW_RECEIVED',
      );
      const feeEntry = entries.find(
        (e) => e.entryType === 'PLATFORM_FEE_RESERVED',
      );
      expect(escrowEntry).toBeDefined();
      expect(feeEntry).toBeDefined();
    });

    it('admin rejects payment → returns to READY_FOR_PAYMENT', async () => {
      const { deal, publicId } = await createTestDeal(prisma, {
        creatorRole: 'seller',
        status: DEAL_STATUS.READY_FOR_PAYMENT,
      });

      const { participant: buyer } = await joinDealAsCounterparty(
        prisma,
        deal.id,
        'buyer',
        'Alice',
      );

      await payments.uploadProof(publicId, undefined, { paid_amount: 100 }, {
        type: 'participant',
        role: 'buyer',
        participantId: buyer.id,
      } as any);

      const payment = await prisma.payment.findFirst({
        where: { dealId: deal.id },
      });
      const { admin: adminUser } = await createAdminAndToken(prisma, jwt);

      const rejected = await payments.adminReject(
        payment!.id,
        'Amount does not match',
        adminUser.id,
      );
      expect(rejected.deal_status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);

      const updatedDeal = await prisma.deal.findUnique({
        where: { id: deal.id },
      });
      expect(updatedDeal!.status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);
    });
  });

  // ─── Task 23.3: Dispute resolution flow ──────────────────────────────────
  describe('Dispute Resolution Flow', () => {
    it('buyer opens dispute → admin resolves with release → RELEASE_PENDING', async () => {
      const { deal, publicId } = await createTestDeal(prisma, {
        creatorRole: 'seller',
        status: DEAL_STATUS.SHIPPED,
      });

      const { participant: buyer } = await joinDealAsCounterparty(
        prisma,
        deal.id,
        'buyer',
        'Alice',
      );
      await prisma.participant.updateMany({
        where: { dealId: deal.id },
        data: { approvedAt: new Date() },
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          dealId: deal.id,
          expectedAmount: 100,
          paidAmount: 100,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe',
          adminStatus: 'verified',
        },
      });

      // Open dispute
      const dispute = await disputes.openDispute(
        publicId,
        { type: 'participant', role: 'buyer', participantId: buyer.id } as any,
        { reason: 'ITEM_NOT_RECEIVED', message: 'Never received the item' },
      );

      expect(dispute.status).toBe(DEAL_STATUS.DISPUTED);

      // Admin resolves with release
      const { admin: adminUser } = await createAdminAndToken(prisma, jwt);
      const resolved = await admin.resolveDispute(
        dispute.dispute_id,
        {
          decision: 'release',
          payout_reference: 'PAYOUT-001',
          admin_note: 'Seller provided tracking proof',
        },
        adminUser.id,
      );

      expect(resolved.status).toBe(DEAL_STATUS.RELEASE_PENDING);

      // Check ledger
      const entries = await ledger.list(deal.id);
      expect(entries.some((e) => e.entryType === 'SELLER_PAYOUT_PENDING')).toBe(
        true,
      );
    });

    it('buyer opens dispute → admin resolves with refund → REFUNDED', async () => {
      const { deal, publicId } = await createTestDeal(prisma, {
        creatorRole: 'seller',
        status: DEAL_STATUS.SHIPPED,
      });

      const { participant: buyer } = await joinDealAsCounterparty(
        prisma,
        deal.id,
        'buyer',
        'Alice',
      );
      await prisma.participant.updateMany({
        where: { dealId: deal.id },
        data: { approvedAt: new Date() },
      });

      await prisma.payment.create({
        data: {
          dealId: deal.id,
          expectedAmount: 100,
          paidAmount: 100,
          currency: 'USD',
          paymentMethod: 'bakong_khqr',
          receiverAccountLabel: 'BothSafe',
          adminStatus: 'verified',
        },
      });

      const dispute = await disputes.openDispute(
        publicId,
        { type: 'participant', role: 'buyer', participantId: buyer.id } as any,
        { reason: 'FAKE_ITEM', message: 'Item is counterfeit' },
      );

      const { admin: adminUser } = await createAdminAndToken(prisma, jwt);
      const resolved = await admin.resolveDispute(
        dispute.dispute_id,
        {
          decision: 'refund',
          refund_reference: 'REFUND-001',
          admin_note: 'Confirmed counterfeit',
        },
        adminUser.id,
      );

      expect(resolved.status).toBe(DEAL_STATUS.REFUNDED);

      const entries = await ledger.list(deal.id);
      expect(entries.some((e) => e.entryType === 'BUYER_REFUND_SENT')).toBe(
        true,
      );
    });
  });

  // ─── Task 23.4: Complete happy path ──────────────────────────────────────
  describe('Complete Happy Path', () => {
    it('full flow: create → join → approve → pay → verify → ship → confirm → release', async () => {
      // 1. Seller creates deal
      const created = await deals.createDeal(
        {
          source: 'web',
          creator_role: 'seller',
          language: 'en',
          product_title: 'Nintendo Switch',
          product_type: 'electronics',
          amount: 300,
          currency: 'USD',
          creator_name: 'Mario',
          creator_phone: '+85511111111',
        } as any,
        null,
      );
      const publicId = created.public_id;

      // 2. Buyer joins
      const inviteToken = new URL(created.invite_url).searchParams.get(
        'invite',
      )!;
      const joined = await deals.joinDeal(
        publicId,
        {
          invite_token: inviteToken,
          role: 'buyer',
          name: 'Luigi',
          preferred_language: 'en',
        } as any,
        { type: 'invite', role: null } as any,
        null,
      );

      const dealRecordAfterJoin = await prisma.deal.findUnique({
        where: { publicId },
        include: { participants: true },
      });
      const sellerP = dealRecordAfterJoin!.participants.find(
        (p) => p.role === 'seller',
      )!;
      const buyerP = dealRecordAfterJoin!.participants.find(
        (p) => p.role === 'buyer',
      )!;

      // 3. Seller adds payout
      await deals.updatePayout(
        publicId,
        {
          payout_khqr: 'mario@aba',
          payout_bank_name: 'ABA',
          payout_account_name: 'Mario',
          payout_account_number: '123',
        } as any,
        {
          type: 'participant',
          role: 'seller',
          participantId: sellerP.id,
        } as any,
      );

      // 4. Both approve
      await deals.approveDeal(publicId, {
        type: 'participant',
        role: 'seller',
        participantId: sellerP.id,
      } as any);
      const approved = await deals.approveDeal(publicId, {
        type: 'participant',
        role: 'buyer',
        participantId: buyerP.id,
      } as any);
      expect(approved.status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);

      // 5. Buyer uploads payment proof
      const paymentUploaded = await payments.uploadProof(
        publicId,
        undefined,
        { paid_amount: 300, buyer_note: 'Paid via Bakong' },
        { type: 'participant', role: 'buyer', participantId: buyerP.id } as any,
      );
      expect(paymentUploaded.status).toBe(
        DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
      );

      // 6. Admin verifies payment
      const payment = await prisma.payment.findFirst({
        where: { dealId: dealRecordAfterJoin!.id },
      });
      const { admin: adminUser } = await createAdminAndToken(
        prisma,
        jwt,
        'admin-happy@test.local',
      );
      const verified = await payments.adminVerify(payment!.id, adminUser.id);
      expect(verified.deal_status).toBe(DEAL_STATUS.SELLER_PREPARING);

      // 7. Seller ships
      const shipped = await shipping.uploadShippingProof(
        publicId,
        {
          type: 'participant',
          role: 'seller',
          participantId: sellerP.id,
        } as any,
        {
          delivery_company: 'Kerry Express',
          tracking_number: 'KE123456',
          seller_note: 'Shipped today',
        },
        {},
      );
      expect(shipped.status).toBe(DEAL_STATUS.SHIPPED);

      // 8. Buyer confirms receipt
      const confirmed = await deals.confirmReceived(publicId, {
        type: 'participant',
        role: 'buyer',
        participantId: buyerP.id,
      } as any);
      expect(confirmed.status).toBe(DEAL_STATUS.RELEASE_PENDING);

      // 9. Admin releases
      const released = await admin.release(
        dealRecordAfterJoin!.id,
        { payout_reference: 'PAYOUT-HAPPY-001' },
        adminUser.id,
      );
      expect(released.status).toBe(DEAL_STATUS.RELEASED);

      // Verify all ledger entries
      const entries = await ledger.list(dealRecordAfterJoin!.id);
      expect(entries.map((e) => e.entryType)).toEqual(
        expect.arrayContaining([
          'ESCROW_RECEIVED',
          'PLATFORM_FEE_RESERVED',
          'SELLER_PAYOUT_PENDING',
          'SELLER_PAYOUT_SENT',
        ]),
      );

      // Verify final deal status
      const finalDeal = await prisma.deal.findUnique({
        where: { id: dealRecordAfterJoin!.id },
      });
      expect(finalDeal!.status).toBe(DEAL_STATUS.RELEASED);
    });
  });
});
