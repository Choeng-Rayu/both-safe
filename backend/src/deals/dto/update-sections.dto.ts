import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) type?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image_url?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) quantity?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class UpdateParticipantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telegram_chat_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() wechat_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() messenger_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preferred_language?:
    | 'km'
    | 'en'
    | 'zh';
}

export class UpdateDeliveryDto {
  // Reserved for future buyer-side delivery preferences. For MVP, no fields required.
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
