import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MESSAGE_KEYS } from '../common/constants';
import {
  CompleteWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/admin-action.dto';
import { WithdrawalsService } from './withdrawals.service';

interface AdminRequest extends Request {
  actor?: { type: 'admin'; adminId: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/withdrawals')
@UseGuards(AdminGuard)
export class AdminWithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Get()
  @ApiOperation({ summary: 'List withdrawals (admin)' })
  async list(@Query('status') status?: string) {
    return {
      message_key: 'withdrawal.admin_list',
      withdrawals: await this.withdrawals.adminList(status),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a withdrawal with full ledger context (admin)',
  })
  async get(@Param('id') id: string) {
    return {
      message_key: 'withdrawal.admin_detail',
      withdrawal: await this.withdrawals.adminGet(id),
    };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Mark a withdrawal as approved for manual payout' })
  async approve(@Req() req: AdminRequest, @Param('id') id: string) {
    const adminId = this.requireAdminId(req);
    return {
      message_key: MESSAGE_KEYS.WITHDRAWAL_APPROVED,
      withdrawal: await this.withdrawals.approve(adminId, id),
    };
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Mark a withdrawal as completed; debits the wallet',
  })
  async complete(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: CompleteWithdrawalDto,
  ) {
    const adminId = this.requireAdminId(req);
    return {
      message_key: MESSAGE_KEYS.WITHDRAWAL_COMPLETED,
      withdrawal: await this.withdrawals.complete(adminId, id, body),
    };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a withdrawal; unlocks the funds' })
  async reject(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: RejectWithdrawalDto,
  ) {
    const adminId = this.requireAdminId(req);
    return {
      message_key: MESSAGE_KEYS.WITHDRAWAL_REJECTED,
      withdrawal: await this.withdrawals.reject(adminId, id, body),
    };
  }

  private requireAdminId(req: AdminRequest): string {
    const adminId = req.actor?.adminId;
    if (!adminId) {
      throw new UnauthorizedException({ messageKey: 'auth.missing_token' });
    }
    return adminId;
  }
}
