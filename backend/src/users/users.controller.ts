import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DealsService } from '../deals/deals.service';
import { UserAuthService } from '../auth/user-auth.service';
import { NotificationService } from '../notifications/notification.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly userAuth: UserAuthService,
    private readonly notifications: NotificationService,
  ) {}

  @Get('me/deals')
  @ApiOperation({
    summary: 'Get current user dashboard — deals grouped by state',
  })
  async getMyDeals(@Req() req: Request) {
    const user = await this.requireUser(req);
    return this.dealsService.getMyDeals(user.id);
  }

  @Get('me/notifications')
  @ApiOperation({ summary: 'List in-app notifications for the current user' })
  async getMyNotifications(
    @Req() req: Request,
    @Query('limit') limitRaw?: string,
  ) {
    const user = await this.requireUser(req);
    const limit = limitRaw ? Number(limitRaw) : 50;
    const rows = await this.notifications.listForUser(user.id, limit);
    return {
      message_key: 'notification.list',
      notifications: rows.map((row) => ({
        id: row.id,
        deal_id: row.dealId,
        event_key: row.eventKey,
        message_key: row.messageKey,
        payload: row.payload ? safeJsonParse(row.payload) : null,
        delivered: row.delivered,
        created_at: row.createdAt.toISOString(),
      })),
    };
  }

  private async requireUser(req: Request) {
    const rawToken = req.cookies?.[this.userAuth.cookieName];
    if (!rawToken)
      throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    const user = await this.userAuth.resolveSession(rawToken);
    if (!user)
      throw new UnauthorizedException({ messageKey: 'auth.session_expired' });
    return user;
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
