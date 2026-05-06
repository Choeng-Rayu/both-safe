import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ messageKey: 'auth.missing_token' });
    }
    const token = header.slice('Bearer '.length);
    const { adminId, email } = await this.auth.verifyAdminJwt(token);
    req.actor = { type: 'admin', adminId, email };
    return true;
  }
}
