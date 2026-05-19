import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { ExpirationService } from './expiration.service';
import { AuthModule } from '../auth/auth.module';
import { TransfersModule } from '../transfers/transfers.module';
import { WalletsModule } from '../wallets/wallets.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [ConfigModule, AuthModule, TransfersModule, WalletsModule, LedgerModule],
  controllers: [DealsController],
  providers: [DealsService, ExpirationService],
  exports: [DealsService],
})
export class DealsModule {}
