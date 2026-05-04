import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DigitalProductService } from './digital-product.service';
import { AddProductVersionDto, CreateProductDto } from './dto';

@Controller('products')
export class DigitalProductController {
  constructor(private readonly products: DigitalProductService) {}

  @Get()
  listProducts() {
    return this.products.listProducts();
  }

  @Get(':id')
  getProduct(@Param('id') id: string) {
    return this.products.findProduct(id);
  }

  @Post()
  createProduct(@Body() body: CreateProductDto) {
    return this.products.createProduct(body);
  }

  @Post(':id/versions')
  addVersion(@Param('id') id: string, @Body() body: AddProductVersionDto) {
    return this.products.addVersion(id, body);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.products.submitForReview(id);
  }
}
