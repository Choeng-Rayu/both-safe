import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from '../common/utils/tokens';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import { RequestActor } from '../common/decorators/current-actor.decorator';

/**
 * Deal-room and invite token resolution.
 *
 * Admin login was removed from this service: the platform now uses
 * a single login form (see UserAuthService) and admin status is
 * driven by `User.role === 'ADMIN'`. The AdminGuard reads the same
 * session cookie issued by the unified login flow.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
  ) {}

  // Resolve a participant or creator by raw access token + dealPublicId
  async resolveDealActor(
    rawToken: string,
    publicId: string,
  ): Promise<RequestActor | null> {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);
    const deal = await this.prisma.deal.findUnique({
      where: { publicId },
      include: { participants: true },
    });
    if (!deal) return null;

    if (deal.creatorAccessTokenHash === tokenHash) {
      return {
        type: 'creator',
        dealId: deal.id,
        role: deal.creatorRole as 'buyer' | 'seller',
        rawToken,
      };
    }
    const matching = deal.participants.find(
      (p) => p.accessTokenHash === tokenHash,
    );
    if (matching) {
      return {
        type: 'participant',
        dealId: deal.id,
        role: matching.role as 'buyer' | 'seller',
        participantId: matching.id,
        rawToken,
      };
    }
    return null;
  }

  // Resolve invite token (does not need publicId; we accept it bound to a deal id)
  async resolveInviteActor(
    rawInvite: string,
    publicId: string,
  ): Promise<RequestActor | null> {
    if (!rawInvite) return null;
    const tokenHash = hashToken(rawInvite);
    const deal = await this.prisma.deal.findUnique({ where: { publicId } });
    if (!deal) return null;
    if (deal.inviteTokenHash !== tokenHash) return null;
    if (deal.inviteExpiresAt && deal.inviteExpiresAt.getTime() < Date.now())
      return null;
    return { type: 'invite', dealId: deal.id, rawToken: rawInvite };
  }
}
