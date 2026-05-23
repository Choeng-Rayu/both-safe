import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteWithdrawalDto {
  @ApiProperty({
    required: false,
    description: 'Bank or Bakong reference for the completed payout',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  provider_reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  admin_note?: string;
}

export class RejectWithdrawalDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}
