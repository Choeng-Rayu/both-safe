import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { IsString } from 'class-validator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BakongTokenService } from './bakong-token.service';
import { BakongPollService } from './bakong-poll.service';

class VerifyCodeDto {
  @IsString() code!: string;
}

/**
 * Bakong API management endpoints — all admin-only.
 *
 * Setup flow (one-time):
 *   1. POST /v1/bakong/setup/request-email  → sends verification code to BAKONG_EMAIL
 *   2. POST /v1/bakong/setup/verify { code } → returns API token (copy to .env BAKONG_API_TOKEN)
 *
 * Buyer payments are auto-verified by polling Bakong against the KHQR
 * MD5 stored on the Payment row. Released funds land in the seller's
 * BothSafe wallet, and sellers cash out via /v1/withdrawals — there is
 * no admin-driven Bakong payout deeplink any more.
 */
@ApiTags('bakong')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(AdminGuard)
@Controller('bakong')
export class BakongController {
  constructor(
    private readonly tokenSvc: BakongTokenService,
    private readonly pollSvc: BakongPollService,
  ) {}

  // ---------- One-time setup ----------

  @Post('setup/request-email')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request Bakong verification email (first-time setup only)',
  })
  async requestEmail() {
    await this.tokenSvc.requestEmail();
    return {
      ok: true,
      message: 'Verification code sent to your BAKONG_EMAIL address.',
    };
  }

  @Post('setup/verify')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Verify email code and get API token (copy to .env BAKONG_API_TOKEN)',
  })
  async verify(@Body() dto: VerifyCodeDto) {
    const token = await this.tokenSvc.verify(dto.code);
    return {
      token,
      note: 'Copy this token to BAKONG_API_TOKEN in your .env file to persist across restarts.',
    };
  }

  // ---------- Transaction verification ----------

  @Get('status/:md5')
  @ApiOperation({ summary: 'Check Bakong transaction status by MD5 hash' })
  async status(@Param('md5') md5: string) {
    return this.pollSvc.check(md5);
  }

  @Post('callback')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Bakong deeplink callback webhook (for future automation)',
  })
  async callback(@Body() body: { md5?: string }) {
    if (body.md5) {
      const status = await this.pollSvc.check(body.md5);
      return { received: true, status };
    }
    return { received: true };
  }
}
