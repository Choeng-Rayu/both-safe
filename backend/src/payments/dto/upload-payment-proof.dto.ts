import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadPaymentProofDto {
  @ApiProperty({ description: 'Amount the buyer actually paid' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  paid_amount!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  buyer_note?: string;

  @ApiPropertyOptional({ description: 'Idempotency key (UUID)' })
  @IsOptional() @IsString() @MaxLength(120)
  idempotency_key?: string;

  @ApiPropertyOptional({ description: 'KHQR MD5 hash if provided' })
  @IsOptional() @IsString() @MaxLength(32)
  khqr_md5?: string;
}

export class RejectPaymentDto {
  @ApiProperty() @IsString() @MaxLength(500)
  reason!: string;
}
