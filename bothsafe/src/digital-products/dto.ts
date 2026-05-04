import { ProductType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsUUID()
  sellerId!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsEnum(ProductType)
  type!: ProductType;

  @IsInt()
  @IsPositive()
  priceMinor!: number;

  @IsString()
  currency!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  refundPolicy?: string;
}

export class AddProductVersionDto {
  @IsString()
  storageKey!: string;

  @IsString()
  sha256!: string;

  @IsInt()
  @IsPositive()
  fileSize!: number;

  @IsString()
  mimeType!: string;
}
