import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserAuthService } from '../user-auth.service';

/**
 * Admin authorization guard.
 *
 * The platform now uses a single login form for everyone. Admins
 * are differentiated by `User.role === 'ADMIN'` rather than living
 * in a separate auth system. This guard:
 *
 *   1. Pulls the BothSafe session cookie set by the unified login.
 *   2. Resolves it via `UserAuthService.resolveSession` (which
 *      already rejects disabled users).
 *   3. Confirms the resolved user has the ADMIN role.
 *
 * Downstream controllers continue to read `req.actor.adminId` for
 * audit logs and ledger entries — that field now holds the admin's
 * User id, which is interchangeable with the legacy Admin.id since
 * those columns were never foreign keys.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userAuth: UserAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<
      Request & {
        actor?: { type: 'admin'; adminId: string; email: string | null };
        sessionUser?: unknown;
      }
    >();

    const rawToken: string | undefined =
      req.cookies?.[this.userAuth.cookieName];
    if (!rawToken) {
      throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    }

    const user = await this.userAuth.resolveSession(rawToken);
    if (!user) {
      throw new UnauthorizedException({ messageKey: 'auth.session_expired' });
    }
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException({ messageKey: 'auth.admin_only' });
    }

    req.actor = { type: 'admin', adminId: user.id, email: user.email };
    req.sessionUser = user;
    return true;
  }
}
