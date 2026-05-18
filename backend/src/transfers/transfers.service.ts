import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';

/**
 * Reserved for future bot-initiated or automated transfer flows.
 *
 * The canonical seller-release and buyer-refund paths now live on
 * AdminService.release() and AdminService.refund(), which credit the
 * participant's BothSafe wallet atomically with the deal status change.
 * External payouts happen at withdrawal time (WithdrawalsService) where
 * admin reviews each request and pays via Bakong / bank manually.
 *
 * This class is intentionally minimal — keeping the module wired in so
 * existing TransferAttempt rows remain queryable and so a future
 * auto-payout integration has a place to land without an architectural
 * shuffle.
 */
@Injectable()
export class TransfersService {
  constructor(private readonly logger: WinstonLoggerService) {}

  /** Convenience accessor for logging context (no behaviour). */
  describe(): string {
    return 'transfers: wallet-routed (see WithdrawalsService for cash-out)';
  }
}
