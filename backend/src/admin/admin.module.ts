import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { BakongModule } from '../bakong/bakong.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [AuthModule, PaymentsModule, BakongModule, WalletsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

