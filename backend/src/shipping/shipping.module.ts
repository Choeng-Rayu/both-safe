import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { AuthModule } from '../auth/auth.module';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [AuthModule, TransfersModule],
  providers: [ShippingService],
  controllers: [ShippingController],
})
export class ShippingModule {}
