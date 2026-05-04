import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDealDto {
  @IsUUID()
  buyerId!: string;

  @IsUUID()
  productId!: string;
}

export class BuyerConfirmDto {
  @IsUUID()
  buyerId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
