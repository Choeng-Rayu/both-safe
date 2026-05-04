import { Injectable, NotFoundException } from '@nestjs/common';
import { EntitlementService } from '../entitlements/entitlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, CreateSubscriptionDto } from './dto';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  createPlan(input: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        productId: input.productId,
        name: input.name,
        interval: input.interval,
        priceMinor: BigInt(input.priceMinor),
        currency: input.currency.toUpperCase(),
      },
    });
  }

  listPlans() {
    return this.prisma.plan.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createSubscription(input: CreateSubscriptionDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
      include: { product: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, plan.interval);
    const subscription = await this.prisma.subscription.create({
      data: {
        buyerId: input.buyerId,
        planId: input.planId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await this.entitlements.grantSubscriptionAccess({
      subscriptionId: subscription.id,
      buyerId: input.buyerId,
      productId: plan.productId,
      startsAt: now,
      endsAt: periodEnd,
    });

    return subscription;
  }

  listSubscriptions() {
    return this.prisma.subscription.findMany({
      include: { plan: { include: { product: true } }, buyer: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private calculatePeriodEnd(start: Date, interval: string) {
    const end = new Date(start);

    if (interval === 'yearly') {
      end.setFullYear(end.getFullYear() + 1);
      return end;
    }

    if (interval === 'lifetime') {
      end.setFullYear(end.getFullYear() + 100);
      return end;
    }

    end.setMonth(end.getMonth() + 1);
    return end;
  }
}
