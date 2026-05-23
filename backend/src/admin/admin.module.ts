import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [AuthModule, PaymentsModule, WalletsModule],
  controllers: [AdminController, AdminUsersController],
  providers: [AdminService, AdminUsersService],
})
export class AdminModule {}
