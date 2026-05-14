import { Module, Logger, OnModuleInit, Injectable } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { BotModule } from './bot/bot.module';
import { UsersModule } from './users/users.module';
import { TransfersModule } from './transfers/transfers.module';
import { BakongModule } from './bakong/bakong.module';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_MASTER_KEY',
];

@Injectable()
class EnvValidationService implements OnModuleInit {
  private readonly logger = new Logger('ConfigValidation');

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    const missing = REQUIRED_ENV.filter((key) => {
      const value = this.config.get<string>(key);
      return !value || value.startsWith('replace_') || value.startsWith('base64_');
    });

    if (missing.length) {
      this.logger.error(`Missing or placeholder environment variables: ${missing.join(', ')}`);
      this.logger.error('Please copy .env.example to .env and fill in real values.');
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),

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
    BotModule,
    UsersModule,
    TransfersModule,
    BakongModule,
  ],
  providers: [
    EnvValidationService,
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
