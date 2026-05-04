import { Controller, Get, Header, Param } from '@nestjs/common';
import { EmbedService } from './embed.service';

@Controller('embed')
export class EmbedController {
  constructor(private readonly embed: EmbedService) {}

  @Get(':productId')
  getCheckoutConfig(@Param('productId') productId: string) {
    return this.embed.getCheckoutConfig(productId);
  }

  @Get(':productId/button.js')
  @Header('content-type', 'application/javascript; charset=utf-8')
  getButtonScript(@Param('productId') productId: string) {
    return this.embed.getButtonScript(productId);
  }
}
