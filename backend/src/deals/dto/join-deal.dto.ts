import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinDealDto {
  @ApiProperty()
  @IsString()
  invite_token!: string;

  @ApiProperty({ enum: ['buyer', 'seller'] })
  @IsIn(['buyer', 'seller'])
  role!: 'buyer' | 'seller';

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiProperty({ enum: ['km', 'en', 'zh'] })
  @IsIn(['km', 'en', 'zh'])
  preferred_language!: 'km' | 'en' | 'zh';

  @ApiPropertyOptional() @IsOptional() @IsString() telegram_chat_id?: string;
}
