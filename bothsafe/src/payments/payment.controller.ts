import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateCheckoutDto } from './dto';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  listPayments() {
    return this.payments.listPayments();
  }

  @Get('capabilities')
  capabilities() {
    return this.payments.getCapabilities();
  }

  @Post('checkout')
  createCheckout(@Body() body: CreateCheckoutDto) {
    return this.payments.createCheckoutOrder(body.dealId, body.rail);
  }
}
