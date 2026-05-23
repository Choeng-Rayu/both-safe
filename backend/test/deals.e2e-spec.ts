import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { FilesService } from '../src/files/files.service';
import { NotificationService } from '../src/notifications/notification.service';
import { AuditService } from '../src/common/services/audit.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserSessionGuard } from '../src/auth/guards/user-session.guard';
import { DEAL_STATUS } from '../src/common/constants';
import { hashToken } from '../src/common/utils/tokens';
import {
  cleanDatabase,
  createMockFilesService,
  createMockNotificationService,
  createMockAuditService,
} from './test-utils';

// Ensure consistent JWT secret for test
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Mock UserSessionGuard to allow all requests in E2E tests
class MockUserSessionGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

describe('E2E: BothSafe API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
    })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(FilesService)
      .useValue(createMockFilesService())
      .overrideProvider(NotificationService)
      .useValue(createMockNotificationService())
      .overrideProvider(AuditService)
      .useValue(createMockAuditService())
      .overrideGuard(UserSessionGuard)
      .useValue(new MockUserSessionGuard())
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);

    await prisma.$connect();
  });

  afterAll(async () => {
    try {
      await app.close();
    } catch {
      // Bot may throw on shutdown — ignore
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const admin = await prisma.admin.create({
      data: {
        email: 'admin@test.local',
        passwordHash: '$2a$10$testhash',
        name: 'Test Admin',
        active: true,
      },
    });
    adminId = admin.id;
    adminToken = jwt.sign({ sub: admin.id, email: admin.email, role: 'admin' });
  });

  // ─── Task 25.3: Admin endpoints ──────────────────────────────────────────
  describe('Admin Endpoints', () => {
    it('GET /admin/deals — list with filters and pagination', async () => {
      // Seed some deals
      await prisma.deal.createMany({
        data: [
          {
            publicId: 'deal1',
            creatorRole: 'buyer',
            source: 'web',
            status: DEAL_STATUS.DRAFT,
            currency: 'USD',
            creatorAccessTokenHash:
              '33112ee14ee469c3eb52fe90322ec81dd404a0093d565a6d71ce77cbc8124e3b',
            amount: 100,
          },
          {
            publicId: 'deal2',
            creatorRole: 'seller',
            source: 'web',
            status: DEAL_STATUS.READY_FOR_PAYMENT,
            currency: 'USD',
            creatorAccessTokenHash:
              'f998fe06afa0cfbe73e0449dc2b1698309e1b5714960f027b2858312b152c275',
            amount: 200,
          },
          {
            publicId: 'deal3',
            creatorRole: 'buyer',
            source: 'telegram',
            status: DEAL_STATUS.SHIPPED,
            currency: 'USD',
            creatorAccessTokenHash:
              '97fb5f8538b89f6c1accfd19836b65a73b61fbc2e0cbf84bb858a0fffa3f1592',
            amount: 300,
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/admin/deals')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(3);
      expect(res.body.total).toBe(3);
      expect(res.body.page).toBe(1);
    });

    it('GET /admin/deals — filter by status', async () => {
      await prisma.deal.createMany({
        data: [
          {
            publicId: 'd1',
            creatorRole: 'buyer',
            source: 'web',
            status: DEAL_STATUS.DRAFT,
            currency: 'USD',
            creatorAccessTokenHash:
              '33112ee14ee469c3eb52fe90322ec81dd404a0093d565a6d71ce77cbc8124e3b',
          },
          {
            publicId: 'd2',
            creatorRole: 'buyer',
            source: 'web',
            status: DEAL_STATUS.SHIPPED,
            currency: 'USD',
            creatorAccessTokenHash:
              'f998fe06afa0cfbe73e0449dc2b1698309e1b5714960f027b2858312b152c275',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/admin/deals?status=SHIPPED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].status).toBe(DEAL_STATUS.SHIPPED);
    });

    it('GET /admin/deals/:dealId — get deal details', async () => {
      const deal = await prisma.deal.create({
        data: {
          publicId: 'detail1',
          creatorRole: 'seller',
          source: 'web',
          status: DEAL_STATUS.READY_FOR_PAYMENT,
          currency: 'USD',
          amount: 500,
          creatorAccessTokenHash:
            '33112ee14ee469c3eb52fe90322ec81dd404a0093d565a6d71ce77cbc8124e3b',
          product: { create: { title: 'Test Product', type: 'electronics' } },
          participants: {
            create: {
              role: 'seller',
              name: 'Seller',
              accessTokenHash:
                'f998fe06afa0cfbe73e0449dc2b1698309e1b5714960f027b2858312b152c275',
            },
          },
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/admin/deals/${deal.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.publicId).toBe('detail1');
      expect(res.body.participants).toHaveLength(1);
      expect(res.body.product).toBeDefined();
    });

    it('GET /admin/deals/:dealId/audit-log — returns audit entries', async () => {
      const deal = await prisma.deal.create({
        data: {
          publicId: 'audit1',
          creatorRole: 'buyer',
          source: 'web',
          status: DEAL_STATUS.DRAFT,
          currency: 'USD',
          creatorAccessTokenHash: 'h1',
        },
      });
      await prisma.auditLog.create({
        data: {
          dealId: deal.id,
          actorType: 'system',
          action: 'deal.created',
          details: '{}',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/admin/deals/${deal.id}/audit-log`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });
  });

  // ─── Task 25.1: Complete buyer-created flow ──────────────────────────────
  describe('Complete Buyer-Created Flow', () => {
    it('POST /deals → join → approve → payment → verify → ship → confirm → release', async () => {
      // 1. Create deal (buyer as creator)
      const createRes = await request(app.getHttpServer())
        .post('/deals')
        .send({
          source: 'web',
          creator_role: 'buyer',
          language: 'en',
          product_title: 'Test Product',
          product_type: 'electronics',
          amount: 250,
          currency: 'USD',
          creator_name: 'Test Buyer',
          creator_phone: '+85511111111',
        })
        .expect(201);

      expect(createRes.body.status).toBe(DEAL_STATUS.AWAITING_COUNTERPARTY);
      const publicId = createRes.body.public_id;
      const inviteUrl = new URL(createRes.body.invite_url);
      const inviteToken = inviteUrl.searchParams.get('invite');

      // 2. Get deal with invite token
      await request(app.getHttpServer())
        .get(`/deals/${publicId}`)
        .query({ invite: inviteToken })
        .expect(200);

      // 3. Join as seller
      const joinRes = await request(app.getHttpServer())
        .post(`/deals/${publicId}/join`)
        .query({ invite: inviteToken })
        .send({
          invite_token: inviteToken,
          role: 'seller',
          name: 'Test Seller',
          phone: '+85522222222',
          preferred_language: 'en',
        })
        .expect(201);

      expect(joinRes.body.status).toBe(DEAL_STATUS.AWAITING_BOTH_APPROVAL);
      const sellerAccessUrl = new URL(joinRes.body.participant_access_url);
      const sellerAccessToken = sellerAccessUrl.searchParams.get('access');

      // 4. Update payout as seller
      await request(app.getHttpServer())
        .patch(`/deals/${publicId}/sections/payout`)
        .query({ access: sellerAccessToken })
        .send({
          payout_khqr: 'seller@aba',
          payout_bank_name: 'ABA Bank',
          payout_account_name: 'Test Seller',
          payout_account_number: '123456789',
        })
        .expect(200);

      // 5. Approve as seller
      await request(app.getHttpServer())
        .post(`/deals/${publicId}/approval`)
        .query({ access: sellerAccessToken })
        .expect(201);

      // 6. Approve as buyer (creator)
      const creatorAccessUrl = new URL(createRes.body.creator_access_url);
      const creatorAccessToken = creatorAccessUrl.searchParams.get('access');

      const approveRes = await request(app.getHttpServer())
        .post(`/deals/${publicId}/approval`)
        .query({ access: creatorAccessToken })
        .expect(201);

      expect(approveRes.body.status).toBe(DEAL_STATUS.READY_FOR_PAYMENT);

      // 7. Get payment instruction
      const paymentInstrRes = await request(app.getHttpServer())
        .get(`/deals/${publicId}/payment-instruction`)
        .query({ access: creatorAccessToken })
        .expect(200);

      expect(paymentInstrRes.body.method).toBe('bakong_khqr');
      expect(paymentInstrRes.body.currency).toBe('USD');
      expect(paymentInstrRes.body.expected_amount).toBe(250);

      // 8. Upload payment proof as buyer
      const paymentRes = await request(app.getHttpServer())
        .post(`/deals/${publicId}/payment-proofs`)
        .query({ access: creatorAccessToken })
        .field('paid_amount', '250')
        .field('buyer_note', 'Paid via Bakong')
        .expect(201);

      expect(paymentRes.body.status).toBe(
        DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
      );
      const paymentId = paymentRes.body.payment_id;

      // 9. Admin verifies payment
      const verifyRes = await request(app.getHttpServer())
        .post(`/admin/payment-proofs/${paymentId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(verifyRes.body.deal_status).toBe(DEAL_STATUS.SELLER_PREPARING);

      // 10. Seller uploads shipping proof
      const shipRes = await request(app.getHttpServer())
        .post(`/deals/${publicId}/shipping-proofs`)
        .query({ access: sellerAccessToken })
        .field('delivery_company', 'Kerry Express')
        .field('tracking_number', 'KE123456789')
        .field('seller_note', 'Shipped today')
        .expect(201);

      expect(shipRes.body.status).toBe(DEAL_STATUS.SHIPPED);

      // 11. Buyer confirms received
      const confirmRes = await request(app.getHttpServer())
        .post(`/deals/${publicId}/confirm-received`)
        .query({ access: creatorAccessToken })
        .expect(201);

      expect(confirmRes.body.status).toBe(DEAL_STATUS.RELEASE_PENDING);

      // 12. Get deal and verify ledger entries
      const deal = await prisma.deal.findUnique({
        where: { publicId },
        include: { ledgerEntries: true },
      });
      expect(deal!.status).toBe(DEAL_STATUS.RELEASE_PENDING);
      expect(deal!.ledgerEntries.length).toBeGreaterThanOrEqual(2); // ESCROW_RECEIVED, PLATFORM_FEE_RESERVED

      // 13. Admin releases
      const releaseRes = await request(app.getHttpServer())
        .post(`/admin/deals/${deal!.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payout_reference: 'PAYOUT-E2E-001' })
        .expect(201);

      expect(releaseRes.body.status).toBe(DEAL_STATUS.RELEASED);

      const finalDeal = await prisma.deal.findUnique({
        where: { id: deal!.id },
      });
      expect(finalDeal!.status).toBe(DEAL_STATUS.RELEASED);
    });
  });

  // ─── Task 25.2: Dispute flow ─────────────────────────────────────────────
  describe('Dispute Flow', () => {
    it('POST /deals/:id/disputes → admin resolves with refund', async () => {
      const rawSeller = 'seller_disp1';
      const rawBuyer = 'buyer_disp1';
      const rawCreator = 'creator_disp1';

      const deal = await prisma.deal.create({
        data: {
          publicId: 'dispute1',
          creatorRole: 'seller',
          source: 'web',
          status: DEAL_STATUS.SHIPPED,
          currency: 'USD',
          amount: 150,
          creatorAccessTokenHash: hashToken(rawCreator),
          product: { create: { title: 'Dispute Item', type: 'electronics' } },
          participants: {
            create: [
              {
                role: 'seller',
                name: 'Seller',
                accessTokenHash: hashToken(rawSeller),
                approvedAt: new Date(),
              },
              {
                role: 'buyer',
                name: 'Buyer',
                accessTokenHash: hashToken(rawBuyer),
                approvedAt: new Date(),
              },
            ],
          },
          payments: {
            create: {
              expectedAmount: 150,
              paidAmount: 150,
              currency: 'USD',
              paymentMethod: 'bakong_khqr',
              receiverAccountLabel: 'BothSafe',
              adminStatus: 'verified',
            },
          },
          ledgerEntries: {
            create: [
              { entryType: 'ESCROW_RECEIVED', amount: 150, currency: 'USD' },
              {
                entryType: 'PLATFORM_FEE_RESERVED',
                amount: 3,
                currency: 'USD',
              },
              {
                entryType: 'SELLER_PAYOUT_PENDING',
                amount: 147,
                currency: 'USD',
              },
            ],
          },
        },
        include: { participants: true, payments: true },
      });

      // 1. Open dispute as buyer
      const disputeRes = await request(app.getHttpServer())
        .post(`/deals/${deal.publicId}/disputes`)
        .query({ access: rawBuyer })
        .send({ reason: 'ITEM_NOT_RECEIVED', message: 'Never got the package' })
        .expect(201);

      expect(disputeRes.body.status).toBe(DEAL_STATUS.DISPUTED);
      const disputeId = disputeRes.body.dispute_id;

      // Verify dispute record
      const disputeRecord = await prisma.dispute.findUnique({
        where: { id: disputeId },
      });
      expect(disputeRecord!.status).toBe('open');
      expect(disputeRecord!.reason).toBe('ITEM_NOT_RECEIVED');

      // 2. Admin resolves with refund
      const resolveRes = await request(app.getHttpServer())
        .post(`/admin/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'refund',
          refund_reference: 'REFUND-E2E-001',
          admin_note: 'Package lost in transit',
        })
        .expect(201);

      expect(resolveRes.body.status).toBe(DEAL_STATUS.REFUNDED);

      // Verify final state
      const finalDeal = await prisma.deal.findUnique({
        where: { id: deal.id },
      });
      expect(finalDeal!.status).toBe(DEAL_STATUS.REFUNDED);

      const updatedDispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
      });
      expect(updatedDispute!.status).toBe('resolved_refund');

      // Verify refund ledger entries
      const entries = await prisma.ledgerEntry.findMany({
        where: { dealId: deal.id },
      });
      expect(entries.some((e) => e.entryType === 'BUYER_REFUND_SENT')).toBe(
        true,
      );
    });

    it('POST /deals/:id/disputes → admin resolves with release', async () => {
      const rawSeller = 'seller_disp2';
      const rawBuyer = 'buyer_disp2';
      const rawCreator = 'creator_disp2';

      const deal = await prisma.deal.create({
        data: {
          publicId: 'dispute2',
          creatorRole: 'seller',
          source: 'web',
          status: DEAL_STATUS.SHIPPED,
          currency: 'USD',
          amount: 200,
          creatorAccessTokenHash: hashToken(rawCreator),
          product: { create: { title: 'Another Item', type: 'electronics' } },
          participants: {
            create: [
              {
                role: 'seller',
                name: 'Seller2',
                accessTokenHash: hashToken(rawSeller),
                approvedAt: new Date(),
              },
              {
                role: 'buyer',
                name: 'Buyer2',
                accessTokenHash: hashToken(rawBuyer),
                approvedAt: new Date(),
              },
            ],
          },
          payments: {
            create: {
              expectedAmount: 200,
              paidAmount: 200,
              currency: 'USD',
              paymentMethod: 'bakong_khqr',
              receiverAccountLabel: 'BothSafe',
              adminStatus: 'verified',
            },
          },
        },
        include: { participants: true },
      });

      const disputeRes = await request(app.getHttpServer())
        .post(`/deals/${deal.publicId}/disputes`)
        .query({ access: rawBuyer })
        .send({ reason: 'WRONG_ITEM', message: 'Received different item' })
        .expect(201);

      const disputeId = disputeRes.body.dispute_id;

      const resolveRes = await request(app.getHttpServer())
        .post(`/admin/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'release',
          payout_reference: 'PAYOUT-DISP-001',
          admin_note: 'Seller provided correct tracking info',
        })
        .expect(201);

      expect(resolveRes.body.status).toBe(DEAL_STATUS.RELEASE_PENDING);

      const entries = await prisma.ledgerEntry.findMany({
        where: { dealId: deal.id },
      });
      expect(entries.some((e) => e.entryType === 'SELLER_PAYOUT_PENDING')).toBe(
        true,
      );
    });
  });

  // ─── Additional E2E coverage ─────────────────────────────────────────────
  describe('Edge Cases & Error Handling', () => {
    it('returns 401 for non-existent deal without valid token', async () => {
      await request(app.getHttpServer())
        .get('/deals/NONEXISTENT123')
        .query({ access: 'some_token' })
        .expect(401);
    });

    it('returns 401 for missing auth on protected endpoints', async () => {
      await request(app.getHttpServer()).get('/admin/deals').expect(401);
    });

    it('returns 400 for invalid transition', async () => {
      const rawCreator = 'creator_bad';
      const deal = await prisma.deal.create({
        data: {
          publicId: 'badtrans',
          creatorRole: 'buyer',
          source: 'web',
          status: DEAL_STATUS.DRAFT,
          currency: 'USD',
          creatorAccessTokenHash: hashToken(rawCreator),
          participants: {
            create: {
              role: 'buyer',
              name: 'Buyer',
              accessTokenHash: hashToken(rawCreator),
            },
          },
        },
      });

      // Try to confirm received on a DRAFT deal
      await request(app.getHttpServer())
        .post(`/deals/${deal.publicId}/confirm-received`)
        .query({ access: rawCreator })
        .expect(400);
    });

    it('allows buyer to cancel deal in DRAFT', async () => {
      const rawCreator = 'creator_cancel';
      const deal = await prisma.deal.create({
        data: {
          publicId: 'cancel1',
          creatorRole: 'buyer',
          source: 'web',
          status: DEAL_STATUS.DRAFT,
          currency: 'USD',
          creatorAccessTokenHash: hashToken(rawCreator),
          participants: {
            create: {
              role: 'buyer',
              name: 'Buyer',
              accessTokenHash: hashToken(rawCreator),
            },
          },
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/deals/${deal.publicId}/cancel`)
        .query({ access: rawCreator })
        .expect(201);

      expect(res.body.status).toBe(DEAL_STATUS.CANCELLED);
    });

    it('idempotency: admin release with same key returns same result', async () => {
      const rawCreator = 'creator_idemp';
      const deal = await prisma.deal.create({
        data: {
          publicId: 'idemp1',
          creatorRole: 'seller',
          source: 'web',
          status: DEAL_STATUS.RELEASE_PENDING,
          currency: 'USD',
          amount: 100,
          netSellerAmount: 98,
          creatorAccessTokenHash: hashToken(rawCreator),
          participants: {
            create: {
              role: 'seller',
              name: 'Seller',
              accessTokenHash: hashToken(rawCreator),
            },
          },
          ledgerEntries: {
            create: [
              { entryType: 'ESCROW_RECEIVED', amount: 100, currency: 'USD' },
              {
                entryType: 'PLATFORM_FEE_RESERVED',
                amount: 2,
                currency: 'USD',
              },
              {
                entryType: 'SELLER_PAYOUT_PENDING',
                amount: 98,
                currency: 'USD',
              },
            ],
          },
        },
      });

      const idempotencyKey = 'idem-key-001';

      const res1 = await request(app.getHttpServer())
        .post(`/admin/deals/${deal.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payout_reference: 'REF-1', idempotency_key: idempotencyKey })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post(`/admin/deals/${deal.id}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payout_reference: 'REF-1', idempotency_key: idempotencyKey })
        .expect(201);

      expect(res1.body.status).toBe(res2.body.status);
      expect(res1.body.ledger_entries.length).toBe(
        res2.body.ledger_entries.length,
      );
    });
  });
});
