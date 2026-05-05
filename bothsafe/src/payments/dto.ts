import { IsIn, IsUUID } from 'class-validator';
import type { PaymentRail } from './payment-provider.interface';

export class CreateCheckoutDto {
  @IsUUID()
  dealId!: string;

  @IsIn(['binance', 'payway_bakong', 'bakong'])
  rail!: PaymentRail;
}
