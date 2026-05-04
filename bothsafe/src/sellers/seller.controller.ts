import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { SellerService } from './seller.service';

class CreateSellerDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  payoutProvider?: string;

  @IsOptional()
  @IsString()
  payoutIdentifier?: string;
}

@Controller('sellers')
export class SellerController {
  constructor(private readonly sellers: SellerService) {}

  @Get()
  listSellers() {
    return this.sellers.listSellers();
  }

  @Post()
  createSeller(@Body() body: CreateSellerDto) {
    return this.sellers.createSeller(body);
  }
}
