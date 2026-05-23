import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserAuthService } from './user-auth.service';
import { OAuthStateService } from './oauth-state.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './guards/admin.guard';
import { DealAccessGuard } from './guards/deal-access.guard';
import { UserSessionGuard } from './guards/user-session.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    AuthService,
    UserAuthService,
    OAuthStateService,
    AdminGuard,
    DealAccessGuard,
    UserSessionGuard,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    UserAuthService,
    OAuthStateService,
    AdminGuard,
    DealAccessGuard,
    UserSessionGuard,
  ],
})
export class AuthModule {}
