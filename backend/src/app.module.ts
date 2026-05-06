import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DealsModule } from './deals/deals.module';
import { PaymentsModule } from './payments/payments.module';
import { ShippingModule } from './shipping/shipping.module';
import { DisputesModule } from './disputes/disputes.module';
import { AdminModule } from './admin/admin.module';
import { LedgerModule } from './ledger/ledger.module';
import { NotificationModule } from './notifications/notification.module';
import { FilesModule } from './files/files.module';
import { AuditModule } from './common/services/audit.module';
import { HealthModule } from './health/health.module';
import { SeedModule } from './seed/seed.module';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    PrismaModule,
    AuditModule,
    NotificationModule,
    LedgerModule,
    FilesModule,
    AuthModule,

    DealsModule,
    PaymentsModule,
    ShippingModule,
    DisputesModule,
    AdminModule,
    HealthModule,
    SeedModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
