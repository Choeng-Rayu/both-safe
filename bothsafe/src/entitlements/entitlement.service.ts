import { Injectable } from '@nestjs/common';
import {
  AccessGrantStatus,
  EntitlementSource,
  EntitlementStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async canAccess(userId: string, productId: string, action = 'download') {
    const now = new Date();
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        productId,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!entitlement) {
      return { allowed: false, reason: 'no_active_entitlement' };
    }

    if (
      entitlement.usageLimit != null &&
      entitlement.usageCount >= entitlement.usageLimit
    ) {
      return { allowed: false, reason: 'usage_limit_exceeded' };
    }

    return {
      allowed: true,
      reason: 'active_entitlement',
      entitlementId: entitlement.id,
      action,
    };
  }

  async grantOneTimeAccess(input: {
    dealId: string;
    buyerId: string;
    productId: string;
    expiresAt?: Date;
    downloadLimit?: number;
  }) {
    const entitlement = await this.prisma.entitlement.create({
      data: {
        userId: input.buyerId,
        productId: input.productId,
        source: EntitlementSource.ONE_TIME_DEAL,
        sourceId: input.dealId,
        endsAt: input.expiresAt,
        usageLimit: input.downloadLimit ?? 3,
      },
    });

    const accessGrant = await this.prisma.accessGrant.create({
      data: {
        dealId: input.dealId,
        buyerId: input.buyerId,
        productId: input.productId,
        status: AccessGrantStatus.GRANTED,
        expiresAt: input.expiresAt,
        downloadLimit: input.downloadLimit ?? 3,
      },
    });

    return { entitlement, accessGrant };
  }

  async grantSubscriptionAccess(input: {
    subscriptionId: string;
    buyerId: string;
    productId: string;
    startsAt: Date;
    endsAt: Date;
  }) {
    return this.prisma.entitlement.create({
      data: {
        userId: input.buyerId,
        productId: input.productId,
        source: EntitlementSource.SUBSCRIPTION,
        sourceId: input.subscriptionId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });
  }

  async revokeAccess(input: {
    userId: string;
    productId: string;
    sourceId?: string;
  }) {
    return this.prisma.entitlement.updateMany({
      where: {
        userId: input.userId,
        productId: input.productId,
        sourceId: input.sourceId,
        status: EntitlementStatus.ACTIVE,
      },
      data: { status: EntitlementStatus.REVOKED },
    });
  }

  async recordUsage(input: {
    userId: string;
    productId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }) {
    const access = await this.canAccess(
      input.userId,
      input.productId,
      input.action,
    );

    if (!access.allowed || !access.entitlementId) {
      return access;
    }

    await this.prisma.entitlement.update({
      where: { id: access.entitlementId },
      data: { usageCount: { increment: 1 } },
    });
    await this.prisma.usageEvent.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        action: input.action,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });

    return { allowed: true, reason: 'usage_recorded' };
  }
}
