import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentPollerService } from './payment-poller.service';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../common/services/audit.module';
import { NotificationModule } from '../notifications/notification.module';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [ConfigModule, AuthModule, LedgerModule, AuditModule, NotificationModule, TransfersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentPollerService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
