import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './common/config/env.validation';
import { DigitalProductModule } from './digital-products/digital-product.module';
import { DisputeModule } from './disputes/dispute.module';
import { EmbedModule } from './embed/embed.module';
import { EntitlementModule } from './entitlements/entitlement.module';
import { EscrowModule } from './escrow/escrow.module';
import { JobsModule } from './jobs/jobs.module';
import { LedgerModule } from './ledger/ledger.module';
import { PaymentModule } from './payments/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { SellerModule } from './sellers/seller.module';
import { StorageModule } from './storage/storage.module';
import { SubscriptionModule } from './subscriptions/subscription.module';
import { TelegramModule } from './telegram/telegram.module';
import { UserModule } from './users/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    SellerModule,
    StorageModule,
    DigitalProductModule,
    SubscriptionModule,
    EntitlementModule,
    JobsModule,
    LedgerModule,
    PaymentModule,
    EscrowModule,
    DisputeModule,
    AdminModule,
    EmbedModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
