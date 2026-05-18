import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from '../common/utils/tokens';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import { RequestActor } from '../common/decorators/current-actor.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async loginAdmin(email: string, password: string): Promise<{ token: string; admin: { id: string; email: string; name: string | null } }> {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin || !admin.active) {
      this.logger.warn(`Admin login failed for ${email}: invalid credentials or inactive`, AuthService.name);
      throw new UnauthorizedException({ messageKey: 'auth.invalid_credentials' });
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      this.logger.warn(`Admin login failed for ${email}: wrong password`, AuthService.name);
      throw new UnauthorizedException({ messageKey: 'auth.invalid_credentials' });
    }
    const token = await this.jwt.signAsync({ sub: admin.id, role: 'admin', email: admin.email });
    this.logger.action('admin.login', { admin_id: admin.id, email: admin.email });
    return { token, admin: { id: admin.id, email: admin.email, name: admin.name } };
  }

  async verifyAdminJwt(token: string): Promise<{ adminId: string; email: string }> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string; email: string }>(token);
      if (payload.role !== 'admin') throw new UnauthorizedException();
      return { adminId: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException({ messageKey: 'auth.invalid_token' });
    }
  }

  // Resolve a participant or creator by raw access token + dealPublicId
  async resolveDealActor(rawToken: string, publicId: string): Promise<RequestActor | null> {
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
    const matching = deal.participants.find((p) => p.accessTokenHash === tokenHash);
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
  async resolveInviteActor(rawInvite: string, publicId: string): Promise<RequestActor | null> {
    if (!rawInvite) return null;
    const tokenHash = hashToken(rawInvite);
    const deal = await this.prisma.deal.findUnique({ where: { publicId } });
    if (!deal) return null;
    if (deal.inviteTokenHash !== tokenHash) return null;
    if (deal.inviteExpiresAt && deal.inviteExpiresAt.getTime() < Date.now()) return null;
    return { type: 'invite', dealId: deal.id, rawToken: rawInvite };
  }
}
