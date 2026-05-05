import { Body, Controller, Post, Req } from '@nestjs/common';
import { PaymentProviderName } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { PaymentService } from './payment.service';

type RawBodyRequest = FastifyRequest & {
  rawBody?: Buffer | string;
};

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly payments: PaymentService) {}

  @Post('binance')
  handleBinance(@Req() request: RawBodyRequest, @Body() body: object) {
    return this.payments.handleWebhook({
      providerName: PaymentProviderName.BINANCE,
      rawBody: this.getRawBody(request, body),
      parsedBody: body as Record<string, unknown>,
      headers: request.headers,
    });
  }

  @Post('payway')
  handlePayWay(@Req() request: RawBodyRequest, @Body() body: object) {
    return this.payments.handleWebhook({
      providerName: PaymentProviderName.PAYWAY_BAKONG,
      rawBody: this.getRawBody(request, body),
      parsedBody: body as Record<string, unknown>,
      headers: request.headers,
    });
  }

  @Post('bakong')
  handleBakong(@Req() request: RawBodyRequest, @Body() body: object) {
    return this.payments.handleWebhook({
      providerName: PaymentProviderName.BAKONG,
      rawBody: this.getRawBody(request, body),
      parsedBody: body as Record<string, unknown>,
      headers: request.headers,
    });
  }

  private getRawBody(request: RawBodyRequest, body: object): string {
    if (Buffer.isBuffer(request.rawBody)) {
      return request.rawBody.toString('utf8');
    }

    if (typeof request.rawBody === 'string') {
      return request.rawBody;
    }

    return JSON.stringify(body);
  }
}
