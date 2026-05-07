import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { IsString } from 'class-validator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BakongTokenService } from './bakong-token.service';
import { BakongDeeplinkService } from './bakong-deeplink.service';
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
 * Payout flow (per deal):
 *   1. GET /v1/bakong/deals/:dealId/payout-deeplink → returns deeplink URL + seller info
 *   2. Admin opens deeplink on phone → Bakong app opens with amount pre-filled
 *   3. Admin confirms payment in Bakong app
 *   4. POST /v1/admin/deals/:dealId/release { payout_reference } → mark as released
 */
@ApiTags('bakong')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(AdminGuard)
@Controller('bakong')
export class BakongController {
  constructor(
    private readonly tokenSvc: BakongTokenService,
    private readonly deeplinkSvc: BakongDeeplinkService,
    private readonly pollSvc: BakongPollService,
  ) {}

  // ---------- One-time setup ----------

  @Post('setup/request-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request Bakong verification email (first-time setup only)' })
  async requestEmail() {
    await this.tokenSvc.requestEmail();
    return { ok: true, message: 'Verification code sent to your BAKONG_EMAIL address.' };
  }

  @Post('setup/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify email code and get API token (copy to .env BAKONG_API_TOKEN)' })
  async verify(@Body() dto: VerifyCodeDto) {
    const token = await this.tokenSvc.verify(dto.code);
    return {
      token,
      note: 'Copy this token to BAKONG_API_TOKEN in your .env file to persist across restarts.',
    };
  }

  // ---------- Payout deeplink ----------

  @Get('deals/:dealId/payout-deeplink')
  @ApiOperation({
    summary: 'Generate a Bakong deeplink for admin to send seller payout. Open the deeplink on a phone with Bakong app installed.',
  })
  async payoutDeeplink(@Param('dealId') dealId: string) {
    return this.deeplinkSvc.generatePayoutDeeplink(dealId);
  }

  // ---------- Transaction verification ----------

  @Get('status/:md5')
  @ApiOperation({ summary: 'Check Bakong transaction status by MD5 hash' })
  async status(@Param('md5') md5: string) {
    return this.pollSvc.check(md5);
  }

  @Post('callback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bakong deeplink callback webhook (for future automation)' })
  async callback(@Body() body: { md5?: string }) {
    if (body.md5) {
      const status = await this.pollSvc.check(body.md5);
      return { received: true, status };
    }
    return { received: true };
  }
}
