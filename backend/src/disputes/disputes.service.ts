import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import {
  DEAL_STATUS,
  DISPUTE_REASONS,
  FILE_CATEGORIES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
} from '../common/constants';
import { canOpenDispute } from '../deals/status.engine';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { sanitizeText } from '../common/utils/sanitize';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
  ) {}

  async openDispute(
    publicId: string,
    actor: RequestActor,
    body: { reason: string; message: string },
    evidenceFiles: Express.Multer.File[] = [],
  ) {
    if (!actor.role) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    if (!DISPUTE_REASONS.includes(body.reason as any)) {
      throw new BadRequestException({ messageKey: 'dispute.invalid_reason' });
    }
    const deal = await this.prisma.deal.findUnique({
      where: { publicId },
      include: { participants: true },
    });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (!canOpenDispute(deal.status as any)) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    const evidenceUrls: string[] = [];
    for (const f of evidenceFiles) {
      const stored = await this.files.store(f, {
        dealId: deal.id,
        category: FILE_CATEGORIES.DISPUTE_EVIDENCE,
        uploadedBy: actor.participantId ?? actor.role,
      });
      evidenceUrls.push(this.files.signedUrlFor(stored));
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        dealId: deal.id,
        openedByRole: actor.role,
        reason: body.reason,
        message: sanitizeText(body.message) ?? '',
        evidenceUrls: JSON.stringify(evidenceUrls),
        status: 'open',
      },
    });

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.DISPUTED },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: actor.participantId ?? null,
      action: 'dispute.opened',
      details: { dispute_id: dispute.id, reason: body.reason },
    });

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.DISPUTE_OPENED,
      messageKey: MESSAGE_KEYS.DISPUTE_OPENED,
      recipients: [
        { channel: 'inapp', ref: 'admin' },
        ...deal.participants.map((p) => ({ channel: 'inapp' as const, ref: p.id })),
        ...deal.participants
          .filter((p) => p.telegramChatId)
          .map((p) => ({ channel: 'telegram' as const, ref: p.telegramChatId! })),
      ],
      payload: { reason: body.reason },
    });

    return { status: DEAL_STATUS.DISPUTED, dispute_id: dispute.id };
  }
}
