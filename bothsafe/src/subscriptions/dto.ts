import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreatePlanDto {
  @IsUUID()
  productId!: string;

  @IsString()
  name!: string;

  @IsString()
  interval!: 'monthly' | 'yearly' | 'lifetime';

  @IsInt()
  @Min(1)
  priceMinor!: number;

  @IsString()
  currency!: string;
}

export class CreateSubscriptionDto {
  @IsUUID()
  buyerId!: string;

  @IsUUID()
  planId!: string;
}
