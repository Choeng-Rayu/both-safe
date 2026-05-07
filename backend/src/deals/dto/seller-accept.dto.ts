import { IsOptional, IsString } from 'class-validator';

export class SellerAcceptDto {
  @IsOptional()
  @IsString()
  payout_khqr?: string;

  @IsOptional()
  @IsString()
  payout_bank_name?: string;

  @IsOptional()
  @IsString()
  payout_account_name?: string;

  @IsOptional()
  @IsString()
  payout_account_number?: string;

  @IsOptional()
  @IsString()
  payout_khqr_image?: string;

  @IsOptional()
  @IsString()
  expected_shipping_date?: string;

  @IsOptional()
  @IsString()
  delivery_company?: string;
}
