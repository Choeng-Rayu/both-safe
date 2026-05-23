import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { MESSAGE_KEYS } from '../common/constants';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

interface AuthedRequest extends Request {
  sessionUser?: { id: string };
}

@ApiTags('wallet')
@Controller('wallet/withdrawals')
@UseGuards(UserSessionGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a withdrawal request (JSON; typed KHQR or bank account)',
  })
  async create(@Req() req: AuthedRequest, @Body() body: CreateWithdrawalDto) {
    const userId = this.requireUserId(req);
    const withdrawal = await this.withdrawals.createForUser(userId, body);
    return {
      message_key: MESSAGE_KEYS.WITHDRAWAL_CREATED,
      withdrawal,
    };
  }

  @Post('with-image')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseInterceptors(
    FileInterceptor('qr_image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary:
      'Create a withdrawal by uploading a QR image (Bakong, Binance, AcleDA, etc.) and an amount',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        qr_image: { type: 'string', format: 'binary' },
        amount_minor: { type: 'number' },
        currency: { type: 'string', enum: ['USD', 'KHR'] },
        provider_label: { type: 'string' },
      },
      required: ['qr_image', 'amount_minor', 'currency'],
    },
  })
  async createWithImage(
    @Req() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      amount_minor: string | number;
      currency: string;
      provider_label?: string;
    },
  ) {
    const userId = this.requireUserId(req);
    const withdrawal = await this.withdrawals.createWithQrUpload(
      userId,
      {
        currency: body.currency,
        amount_minor: body.amount_minor,
        provider_label: body.provider_label,
      },
      file,
    );
    return {
      message_key: MESSAGE_KEYS.WITHDRAWAL_CREATED,
      withdrawal,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List the current user withdrawal requests' })
  async list(@Req() req: AuthedRequest) {
    const userId = this.requireUserId(req);
    return {
      message_key: 'withdrawal.list',
      withdrawals: await this.withdrawals.listForUser(userId),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a withdrawal by id (owner only)' })
  async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    const userId = this.requireUserId(req);
    return {
      message_key: 'withdrawal.detail',
      withdrawal: await this.withdrawals.getForUser(userId, id),
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending withdrawal' })
  async cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    const userId = this.requireUserId(req);
    return {
      message_key: MESSAGE_KEYS.WITHDRAWAL_CANCELLED,
      withdrawal: await this.withdrawals.cancelForUser(userId, id),
    };
  }

  private requireUserId(req: AuthedRequest): string {
    const user = req.sessionUser;
    if (!user) {
      throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    }
    return user.id;
  }
}
