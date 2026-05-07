import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { AuthModule } from '../auth/auth.module';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [ConfigModule, AuthModule, TransfersModule],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
