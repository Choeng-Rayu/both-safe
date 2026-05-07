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
  FILE_CATEGORIES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
} from '../common/constants';
import { canUploadShippingProof } from '../deals/status.engine';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { sanitizeText } from '../common/utils/sanitize';

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
  ) {}

  async uploadShippingProof(
    publicId: string,
    actor: RequestActor,
    body: {
      delivery_company?: string;
      tracking_number?: string;
      seller_note?: string;
    },
    files: { package_photo?: Express.Multer.File; delivery_receipt?: Express.Multer.File },
  ) {
    if (actor.role !== 'seller') {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    }
    const deal = await this.prisma.deal.findUnique({
      where: { publicId },
      include: { participants: true },
    });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (!canUploadShippingProof(deal.status as any)) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    let packagePhotoUrl: string | undefined;
    let deliveryReceiptUrl: string | undefined;
    if (files.package_photo) {
      const stored = await this.files.store(files.package_photo, {
        dealId: deal.id,
        category: FILE_CATEGORIES.PACKAGE_PHOTO,
        uploadedBy: actor.participantId ?? 'seller',
      });
      packagePhotoUrl = this.files.signedUrlFor(stored);
    }
    if (files.delivery_receipt) {
      const stored = await this.files.store(files.delivery_receipt, {
        dealId: deal.id,
        category: FILE_CATEGORIES.DELIVERY_RECEIPT,
        uploadedBy: actor.participantId ?? 'seller',
      });
      deliveryReceiptUrl = this.files.signedUrlFor(stored);
    }

    const shipping = await this.prisma.shipping.upsert({
      where: { dealId: deal.id },
      update: {
        deliveryCompany: sanitizeText(body.delivery_company) ?? undefined,
        trackingNumber: sanitizeText(body.tracking_number) ?? undefined,
        sellerNote: sanitizeText(body.seller_note) ?? undefined,
        packagePhotoUrl: packagePhotoUrl ?? undefined,
        deliveryReceiptUrl: deliveryReceiptUrl ?? undefined,
      },
      create: {
        dealId: deal.id,
        deliveryCompany: sanitizeText(body.delivery_company) ?? null,
        trackingNumber: sanitizeText(body.tracking_number) ?? null,
        sellerNote: sanitizeText(body.seller_note) ?? null,
        packagePhotoUrl: packagePhotoUrl ?? null,
        deliveryReceiptUrl: deliveryReceiptUrl ?? null,
      },
    });

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.SHIPPED },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: actor.participantId ?? null,
      action: 'shipping.uploaded',
      details: { shipping_id: shipping.id },
    });

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.SHIPPING_UPLOADED,
      messageKey: MESSAGE_KEYS.SHIPPING_UPLOADED,
      recipients: [
        ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
        ...(buyer?.telegramChatId ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }] : []),
      ],
    });

    return { status: DEAL_STATUS.SHIPPED, shipping_id: shipping.id };
  }
}
