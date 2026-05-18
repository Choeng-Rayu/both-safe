import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UserAuthService } from '../auth/user-auth.service';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { CURRENCIES, Currency, MESSAGE_KEYS } from '../common/constants';
import { WalletsService } from './wallets.service';
import { isSupportedCurrency } from './helpers/money';

interface AuthedRequest extends Request {
  sessionUser?: { id: string };
}

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(UserSessionGuard)
export class WalletsController {
  constructor(
    private readonly wallets: WalletsService,
    private readonly userAuth: UserAuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user wallet snapshot' })
  async getMyWallet(@Req() req: AuthedRequest) {
    const userId = this.requireUserId(req);
    const snapshot = await this.wallets.getSnapshot(userId);
    return {
      message_key: 'wallet.summary',
      wallet: {
        wallet_id: snapshot.walletId,
        available_usd_minor: snapshot.availableUsd.toString(),
        available_khr_minor: snapshot.availableKhr.toString(),
        effective_usd_minor: snapshot.effectiveUsd.toString(),
        effective_khr_minor: snapshot.effectiveKhr.toString(),
      },
    };
  }

  @Get('ledger')
  @ApiOperation({ summary: 'List the current user wallet ledger entries' })
  async getLedger(
    @Req() req: AuthedRequest,
    @Query('currency') currencyRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const userId = this.requireUserId(req);
    let currency: Currency | null = null;
    if (currencyRaw) {
      if (!isSupportedCurrency(currencyRaw)) {
        throw new UnauthorizedException({
          messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
          details: { field: 'currency', allowed: Object.values(CURRENCIES) },
        });
      }
      currency = currencyRaw;
    }
    const limit = limitRaw ? Math.min(Number(limitRaw) || 50, 200) : 50;
    const rows = await this.wallets.listLedger(userId, currency, limit, cursor);
    return {
      message_key: 'wallet.ledger',
      entries: rows.map((row) => ({
        id: row.id,
        entry_type: row.entryType,
        direction: row.direction,
        amount_minor: row.amount.toString(),
        currency: row.currency,
        balance_after_minor: row.balanceAfter.toString(),
        deal_id: row.dealId,
        withdrawal_id: row.withdrawalId,
        payment_id: row.paymentId,
        description: row.description,
        created_at: row.createdAt.toISOString(),
      })),
      next_cursor: rows.length === limit ? rows[rows.length - 1].id : null,
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
