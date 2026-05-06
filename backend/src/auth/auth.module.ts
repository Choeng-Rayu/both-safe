import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './guards/admin.guard';
import { DealAccessGuard } from './guards/deal-access.guard';

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
  providers: [AuthService, AdminGuard, DealAccessGuard],
  controllers: [AuthController],
  exports: [AuthService, AdminGuard, DealAccessGuard, JwtModule],
})
export class AuthModule {}
