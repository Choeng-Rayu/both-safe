import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { UserAuthService } from '../user-auth.service';

/**
 * Guard: requires a valid BothSafe user session cookie.
 * Attaches `request.sessionUser` on success.
 */
@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(private readonly userAuth: UserAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const rawToken: string | undefined =
      req.cookies?.[this.userAuth.cookieName];

    if (!rawToken) {
      throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    }

    const user = await this.userAuth.resolveSession(rawToken);
    if (!user) {
      throw new UnauthorizedException({ messageKey: 'auth.session_expired' });
    }

    // Attach to request for downstream use
    (req as Request & { sessionUser: typeof user }).sessionUser = user;
    return true;
  }
}
