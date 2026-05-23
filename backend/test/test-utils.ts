import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { FilesService } from '../src/files/files.service';
import { NotificationService } from '../src/notifications/notification.service';
import { AuditService } from '../src/common/services/audit.service';
import { DEAL_STATUS } from '../src/common/constants';

// Mock file service
export const createMockFilesService = () => ({
  store: jest.fn().mockImplementation((file: any, meta: any) =>
    Promise.resolve({
      id: `file-${Date.now()}`,
      ...meta,
      storageKey: `mock/${file?.originalname ?? 'test'}`,
      sizeBytes: file?.size ?? 0,
      mimeType: file?.mimetype ?? 'image/jpeg',
    }),
  ),
  signedUrlFor: jest
    .fn()
    .mockImplementation(
      (stored: any) => `https://mock-cdn.example.com/${stored.storageKey}`,
    ),
  validateFile: jest.fn().mockReturnValue(true),
});

// Mock notification service
export const createMockNotificationService = () => ({
  notify: jest.fn().mockResolvedValue(undefined),
  timeline: jest.fn().mockResolvedValue([]),
});

// Mock audit service
export const createMockAuditService = () => ({
  record: jest.fn().mockResolvedValue(undefined),
});

// Database cleanup helper — truncates all tables except Prisma migrations
export async function cleanDatabase(prisma: PrismaService) {
  const tablenames = await prisma.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations'`;

  for (const { tablename } of tablenames) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
    );
  }
}

// Create a test admin and return JWT token
export async function createAdminAndToken(
  prisma: PrismaService,
  jwt: JwtService,
  email = 'admin@test.local',
) {
  const admin = await prisma.admin.create({
    data: {
      email,
      passwordHash: '$2a$10$testhash',
      name: 'Test Admin',
      active: true,
    },
  });
  const token = jwt.sign({ sub: admin.id, email: admin.email, role: 'admin' });
  return { admin, token };
}

// Create a deal with a creator participant (returns deal + creator token)
export async function createTestDeal(
  prisma: PrismaService,
  overrides: {
    creatorRole?: 'buyer' | 'seller';
    amount?: number;
    productTitle?: string;
    productType?: string;
    status?: string;
  } = {},
) {
  const creatorRole = overrides.creatorRole ?? 'buyer';
  const amount = overrides.amount ?? 100;
  const publicId = `test${Date.now()}`;
  const creatorAccess = `creator_access_${Date.now()}`;
  const inviteToken = `invite_${Date.now()}`;

  const deal = await prisma.deal.create({
    data: {
      publicId,
      creatorRole,
      source: 'web',
      status: overrides.status ?? DEAL_STATUS.DRAFT,
      currency: 'USD',
      amount,
      creatorAccessTokenHash: `hash_${creatorAccess}`,
      inviteTokenHash: `hash_${inviteToken}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      product: {
        create: {
          title: overrides.productTitle ?? 'Test Product',
          type: overrides.productType ?? 'electronics',
          description: 'A test product',
        },
      },
      participants: {
        create: {
          role: creatorRole,
          name: creatorRole === 'buyer' ? 'Test Buyer' : 'Test Seller',
          accessTokenHash: `hash_${creatorAccess}`,
          approvedAt: null,
        },
      },
    },
    include: { participants: true, product: true },
  });

  const creatorParticipant = deal.participants.find(
    (p) => p.role === creatorRole,
  )!;

  return {
    deal,
    publicId,
    creatorAccess,
    inviteToken,
    creatorParticipant,
    creatorAccessUrl: `/d/${publicId}?access=${creatorAccess}`,
    inviteUrl: `/d/${publicId}?invite=${inviteToken}`,
  };
}

// Join a deal as counterparty
export async function joinDealAsCounterparty(
  prisma: PrismaService,
  dealId: string,
  role: 'buyer' | 'seller',
  name: string,
) {
  const accessToken = `participant_${Date.now()}_${role}`;
  const participant = await prisma.participant.create({
    data: {
      dealId,
      role,
      name,
      accessTokenHash: `hash_${accessToken}`,
      joinedAt: new Date(),
    },
  });
  return { participant, accessToken };
}

// Build a NestJS app for E2E tests with mocked external deps
export async function buildTestApp(
  moduleRef: TestingModule,
): Promise<INestApplication> {
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

// Request helper for E2E tests
export function apiRequest(app: INestApplication) {
  return {
    get: (
      path: string,
      opts: {
        token?: string;
        query?: Record<string, string>;
        cookie?: string;
      } = {},
    ) => {
      let req = request(app.getHttpServer()).get(path);
      if (opts.token) req = req.set('Authorization', `Bearer ${opts.token}`);
      if (opts.cookie) req = req.set('Cookie', opts.cookie);
      if (opts.query) {
        Object.entries(opts.query).forEach(([k, v]) => {
          if (v) req = req.query({ [k]: v });
        });
      }
      return req;
    },
    post: (
      path: string,
      opts: {
        token?: string;
        query?: Record<string, string>;
        cookie?: string;
        body?: any;
      } = {},
    ) => {
      let req = request(app.getHttpServer()).post(path);
      if (opts.token) req = req.set('Authorization', `Bearer ${opts.token}`);
      if (opts.cookie) req = req.set('Cookie', opts.cookie);
      if (opts.query) {
        Object.entries(opts.query).forEach(([k, v]) => {
          if (v) req = req.query({ [k]: v });
        });
      }
      if (opts.body) req = req.send(opts.body);
      return req;
    },
    patch: (
      path: string,
      opts: {
        token?: string;
        query?: Record<string, string>;
        cookie?: string;
        body?: any;
      } = {},
    ) => {
      let req = request(app.getHttpServer()).patch(path);
      if (opts.token) req = req.set('Authorization', `Bearer ${opts.token}`);
      if (opts.cookie) req = req.set('Cookie', opts.cookie);
      if (opts.query) {
        Object.entries(opts.query).forEach(([k, v]) => {
          if (v) req = req.query({ [k]: v });
        });
      }
      if (opts.body) req = req.send(opts.body);
      return req;
    },
  };
}
