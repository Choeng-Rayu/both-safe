import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CURRENCIES,
  WITHDRAWAL_DESTINATION_TYPES,
} from '../../common/constants';

export class WithdrawalDestinationDto {
  @ApiProperty({ enum: Object.values(WITHDRAWAL_DESTINATION_TYPES) })
  @IsIn(Object.values(WITHDRAWAL_DESTINATION_TYPES))
  type!: (typeof WITHDRAWAL_DESTINATION_TYPES)[keyof typeof WITHDRAWAL_DESTINATION_TYPES];

  @ApiProperty({ required: false, description: 'Raw KHQR payload string' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  khqr?: string;

  @ApiProperty({ required: false, description: 'Uploaded KHQR image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  khqr_image?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bank_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  account_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  account_number?: string;
}

export class CreateWithdrawalDto {
  @ApiProperty({ enum: Object.values(CURRENCIES) })
  @IsIn(Object.values(CURRENCIES))
  currency!: (typeof CURRENCIES)[keyof typeof CURRENCIES];

  @ApiProperty({
    description: 'Amount in smallest currency unit (USD cents or KHR riels)',
  })
  @IsInt()
  @Min(1)
  amount_minor!: number;

  @ApiProperty({ type: WithdrawalDestinationDto })
  @ValidateNested()
  @Type(() => WithdrawalDestinationDto)
  destination!: WithdrawalDestinationDto;
}
