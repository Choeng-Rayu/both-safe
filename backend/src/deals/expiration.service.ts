import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { DEAL_STATUS } from '../common/constants';

@Injectable()
export class ExpirationService {
  private readonly logger = new Logger(ExpirationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredDeals() {
    const now = new Date();
    const expiredStatuses = [
      DEAL_STATUS.DRAFT,
      DEAL_STATUS.AWAITING_COUNTERPARTY,
      DEAL_STATUS.AWAITING_BOTH_APPROVAL,
    ];

    const expiredDeals = await this.prisma.deal.findMany({
      where: {
        status: { in: expiredStatuses },
        expiresAt: { lt: now },
      },
    });

    if (expiredDeals.length === 0) return;

    this.logger.log(`Found ${expiredDeals.length} expired deal(s)`);

    for (const deal of expiredDeals) {
      try {
        await this.prisma.deal.update({
          where: { id: deal.id },
          data: { status: DEAL_STATUS.EXPIRED },
        });

        await this.audit.record({
          dealId: deal.id,
          actorType: 'system',
          action: 'deal.expired',
          details: { previous_status: deal.status, expired_at: now.toISOString() },
        });

        this.logger.log(`Deal ${deal.publicId} expired`);
      } catch (err) {
        this.logger.error(`Failed to expire deal ${deal.publicId}`, err);
      }
    }
  }
}
