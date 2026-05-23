import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDealDto {
  @ApiProperty({ enum: ['web', 'telegram'] })
  @IsIn(['web', 'telegram'])
  source!: 'web' | 'telegram';

  @ApiProperty({ enum: ['buyer', 'seller'] })
  @IsIn(['buyer', 'seller'])
  creator_role!: 'buyer' | 'seller';

  @ApiProperty({ enum: ['km', 'en', 'zh'] })
  @IsIn(['km', 'en', 'zh'])
  language!: 'km' | 'en' | 'zh';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  product_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  product_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  product_description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  creator_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  creator_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telegram_chat_id?: string;
}
