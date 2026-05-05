import { Module } from '@nestjs/common';
import { EntitlementModule } from '../entitlements/entitlement.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentController } from './payment.controller';
import { PAYMENT_PROVIDERS } from './payment-provider.interface';
import { PaymentService } from './payment.service';
import { BakongProvider } from './providers/bakong.provider';
import { BinancePayProvider } from './providers/binance-pay.provider';
import { PayWayBakongProvider } from './providers/payway-bakong.provider';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [EntitlementModule, LedgerModule],
  controllers: [PaymentController, WebhookController],
  providers: [
    BinancePayProvider,
    PayWayBakongProvider,
    BakongProvider,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (
        binance: BinancePayProvider,
        payway: PayWayBakongProvider,
        bakong: BakongProvider,
      ) => [binance, payway, bakong],
      inject: [BinancePayProvider, PayWayBakongProvider, BakongProvider],
    },
    PaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
