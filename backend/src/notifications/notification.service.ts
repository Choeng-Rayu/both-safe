import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_EVENTS } from '../common/constants';
import { BOT_NOTIFIER, type IBotNotifier } from './bot-notifier.interface';

type EventKey = keyof typeof NOTIFICATION_EVENTS;

export interface NotifyInput {
  dealId: string;
  eventKey: EventKey | string;
  messageKey: string;
  recipients: Array<{
    channel: 'inapp' | 'telegram' | 'email' | 'sms';
    ref?: string | null;
  }>;
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(BOT_NOTIFIER) private readonly botNotifier: IBotNotifier | null,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    // Resolve deal publicId once (needed for Open Deal Room button in Telegram)
    let dealPublicId: string | undefined;
    try {
      const deal = await this.prisma.deal.findUnique({
        where: { id: input.dealId },
        select: { publicId: true },
      });
      dealPublicId = deal?.publicId;
    } catch {
      // non-critical
    }

    for (const r of input.recipients) {
      try {
        await this.prisma.notification.create({
          data: {
            dealId: input.dealId,
            channel: r.channel,
            recipientRef: r.ref ?? null,
            eventKey: String(input.eventKey),
            messageKey: input.messageKey,
            payload: input.payload ? JSON.stringify(input.payload) : null,
            delivered: r.channel === 'inapp', // inapp is delivered immediately via timeline
          },
        });

        if (r.channel === 'telegram' && r.ref) {
          this.logger.log(`telegram-notify chat=${r.ref} event=${String(input.eventKey)}`);
          // Delegate actual Telegram delivery to bot adapter.
          // Failures must not propagate back (deal status update must not be rolled back).
          if (this.botNotifier) {
            this.botNotifier
              .sendNotification({
                chatId: r.ref,
                eventKey: String(input.eventKey),
                dealPublicId,
                dealId: input.dealId,
              })
              .catch((err: Error) => {
                this.logger.warn(
                  `botNotifier failed chat=${r.ref} event=${String(input.eventKey)}: ${err.message}`,
                );
              });
          }
        }
      } catch (err) {
        this.logger.warn(
          `notification failed deal=${input.dealId} channel=${r.channel}: ${(err as Error).message}`,
        );
      }
    }
  }

  async timeline(dealId: string) {
    return this.prisma.notification.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
