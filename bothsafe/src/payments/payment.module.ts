import { Module } from '@nestjs/common';
import { EntitlementModule } from '../entitlements/entitlement.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentController } from './payment.controller';
import { PAYMENT_PROVIDERS } from './payment-provider.interface';
import { PaymentService } from './payment.service';
import { BinancePayProvider } from './providers/binance-pay.provider';
import { PayWayBakongProvider } from './providers/payway-bakong.provider';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [EntitlementModule, LedgerModule],
  controllers: [PaymentController, WebhookController],
  providers: [
    BinancePayProvider,
    PayWayBakongProvider,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (
        binance: BinancePayProvider,
        payway: PayWayBakongProvider,
      ) => [binance, payway],
      inject: [BinancePayProvider, PayWayBakongProvider],
    },
    PaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
