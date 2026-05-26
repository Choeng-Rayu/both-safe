import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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

  @Post(':id/complete')
  @UseInterceptors(
    FileInterceptor('proof_image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary:
      'Complete a withdrawal: admin uploads a screenshot of the external payment they sent. The withdrawal moves PENDING_REVIEW → COMPLETED, the wallet is unlocked and debited atomically, and the user is notified with the proof image.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        proof_image: { type: 'string', format: 'binary' },
        provider_reference: { type: 'string' },
        admin_note: { type: 'string' },
      },
      required: ['proof_image'],
    },
  })
  async complete(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CompleteWithdrawalDto,
  ) {
    const adminId = this.requireAdminId(req);
    return {
      message_key: MESSAGE_KEYS.WITHDRAWAL_COMPLETED,
      withdrawal: await this.withdrawals.completeWithProof(
        adminId,
        id,
        file,
        body,
      ),
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
