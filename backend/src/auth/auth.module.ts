import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserAuthService } from './user-auth.service';
import { OAuthStateService } from './oauth-state.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './guards/admin.guard';
import { DealAccessGuard } from './guards/deal-access.guard';
import { UserSessionGuard } from './guards/user-session.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  providers: [AuthService, UserAuthService, OAuthStateService, AdminGuard, DealAccessGuard, UserSessionGuard],
  controllers: [AuthController],
  exports: [AuthService, UserAuthService, OAuthStateService, AdminGuard, DealAccessGuard, UserSessionGuard, JwtModule],
})
export class AuthModule {}
