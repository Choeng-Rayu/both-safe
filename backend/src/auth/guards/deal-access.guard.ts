import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UserAuthService } from '../user-auth.service';

/**
 * Resolves a deal actor for a deal-room request.
 *
 * Order of precedence:
 *   1. BothSafe session cookie. If the cookie belongs to a user
 *      with `role=ADMIN`, treat the request as an admin override.
 *   2. `?access=` query — creator/participant deal access token.
 *   3. `?invite=` query — invite token from the counterparty link.
 *
 * Admins now use the unified login session cookie instead of a
 * separate Bearer JWT. The legacy admin JWT path was removed when
 * the platform consolidated on User.role.
 */
@Injectable()
export class DealAccessGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly userAuth: UserAuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const publicId = req.params.publicId;

    // admin via session cookie
    const sessionToken: string | undefined =
      req.cookies?.[this.userAuth.cookieName];
    if (sessionToken) {
      const sessionUser = await this.userAuth.resolveSession(sessionToken);
      if (sessionUser?.role === 'ADMIN') {
        req.actor = {
          type: 'admin',
          adminId: sessionUser.id,
          email: sessionUser.email,
        };
        return true;
      }
    }

    const access =
      (req.query.access as string) || (req.body?.access_token as string) || '';
    if (access) {
      const actor = await this.auth.resolveDealActor(access, publicId);
      if (actor) {
        req.actor = actor;
        return true;
      }
    }

    const invite =
      (req.query.invite as string) || (req.body?.invite_token as string) || '';
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
