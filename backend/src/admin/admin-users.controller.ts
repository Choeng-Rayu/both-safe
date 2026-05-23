import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminUsersService } from './admin-users.service';
import { CURRENCIES, Currency } from '../common/constants';
import { isSupportedCurrency } from '../wallets/helpers/money';

class DisableUserDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

interface AdminRequest extends Request {
  actor?: { type: 'admin'; adminId: string; email: string | null };
}

@ApiTags('admin')
@SkipThrottle()
@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with wallet snapshot and counts' })
  list(
    @Query('search') search?: string,
    @Query('role') role?: 'USER' | 'ADMIN' | 'all',
    @Query('status') status?: 'all' | 'active' | 'disabled',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.users.listUsers({ search, role, status, page, pageSize });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user profile with wallet snapshot and recent activity',
  })
  detail(@Param('id') id: string) {
    return this.users.getUserDetail(id);
  }

  @Get(':id/wallet/ledger')
  @ApiOperation({ summary: 'Wallet ledger entries for a specific user' })
  ledger(
    @Param('id') id: string,
    @Query('currency') currency?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    let parsedCurrency: Currency | undefined;
    if (currency) {
      if (!isSupportedCurrency(currency)) {
        throw new BadRequestException({
          messageKey: 'validation.failed',
          details: { field: 'currency', allowed: Object.values(CURRENCIES) },
        });
      }
      parsedCurrency = currency;
    }
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.users.getUserWalletLedger(id, {
      currency: parsedCurrency,
      limit: parsedLimit,
      cursor,
    });
  }

  @Post(':id/disable')
  @ApiOperation({ summary: 'Disable a user (revokes sessions immediately)' })
  disable(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: DisableUserDto,
  ) {
    return this.users.setDisabled(
      id,
      this.requireAdminId(req),
      true,
      dto.reason,
    );
  }

  @Post(':id/enable')
  @ApiOperation({ summary: 'Re-enable a previously disabled user' })
  enable(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.users.setDisabled(id, this.requireAdminId(req), false);
  }

  private requireAdminId(req: AdminRequest): string {
    const adminId = req.actor?.adminId;
    if (!adminId) {
      throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    }
    return adminId;
  }
}
