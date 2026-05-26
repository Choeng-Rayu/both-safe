import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateDealFeedbackDto {
  @ApiProperty({ minimum: 1, maximum: 5, description: '1–5 star rating' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: 'Optional free-form comment, up to 2000 chars' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
