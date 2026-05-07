import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BakongTokenService } from './bakong-token.service';
import { BakongDeeplinkService } from './bakong-deeplink.service';
import { BakongPollService } from './bakong-poll.service';
import { BakongController } from './bakong.controller';

@Module({
  imports: [HttpModule, PrismaModule, AuthModule],
  controllers: [BakongController],
  providers: [BakongTokenService, BakongDeeplinkService, BakongPollService],
  exports: [BakongDeeplinkService, BakongPollService, BakongTokenService],
})
export class BakongModule {}

