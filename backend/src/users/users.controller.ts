import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DealsService } from '../deals/deals.service';
import { UserAuthService } from '../auth/user-auth.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly userAuth: UserAuthService,
  ) {}

  @Get('me/deals')
  @ApiOperation({ summary: 'Get current user dashboard — deals grouped by state' })
  async getMyDeals(@Req() req: Request) {
    const rawToken = req.cookies?.[this.userAuth.cookieName];
    if (!rawToken) throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    const user = await this.userAuth.resolveSession(rawToken);
    if (!user) throw new UnauthorizedException({ messageKey: 'auth.session_expired' });
    return this.dealsService.getMyDeals(user.id);
  }
}
