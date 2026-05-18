import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../common/services/audit.module';
import { NotificationModule } from '../notifications/notification.module';
import { WalletsModule } from '../wallets/wallets.module';
import { TransfersService } from './transfers.service';

@Module({
  imports: [ConfigModule, LedgerModule, AuditModule, NotificationModule, WalletsModule],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
