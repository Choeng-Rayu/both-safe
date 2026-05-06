import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

// Resolves a deal actor from `?access=` (creator/participant) or `?invite=` (invite-only join).
// Also recognises `Authorization: Bearer <admin jwt>` so admins can read any deal.
@Injectable()
export class DealAccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const publicId = req.params.publicId;

    // admin via JWT
    const header = req.headers['authorization'] as string | undefined;
    if (header?.startsWith('Bearer ')) {
      try {
        const { adminId, email } = await this.auth.verifyAdminJwt(header.slice(7));
        req.actor = { type: 'admin', adminId, email };
        return true;
      } catch {
        // fall through
      }
    }

    const access = (req.query.access as string) || (req.body?.access_token as string) || '';
    if (access) {
      const actor = await this.auth.resolveDealActor(access, publicId);
      if (actor) {
        req.actor = actor;
        return true;
      }
    }

    const invite = (req.query.invite as string) || (req.body?.invite_token as string) || '';
    if (invite) {
      const actor = await this.auth.resolveInviteActor(invite, publicId);
      if (actor) {
        req.actor = actor;
        return true;
      }
    }

    throw new UnauthorizedException({ messageKey: 'auth.invalid_token' });
  }
}
