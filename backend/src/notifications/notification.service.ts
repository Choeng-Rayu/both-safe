import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_EVENTS } from '../common/constants';

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

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput): Promise<void> {
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
          // MVP stub: real Telegram sending is handled by the bot service.
          this.logger.log(`telegram-notify chat=${r.ref} key=${input.messageKey}`);
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
