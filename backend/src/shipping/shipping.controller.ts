import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { DealAccessGuard } from '../auth/guards/deal-access.guard';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller('deals/:publicId')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post('shipping-proofs')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'package_photo', maxCount: 1 },
        { name: 'delivery_receipt', maxCount: 1 },
      ],
      { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } },
    ),
  )
  @ApiOperation({ summary: 'Seller uploads shipping proof' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        delivery_company: { type: 'string' },
        tracking_number: { type: 'string' },
        seller_note: { type: 'string' },
        package_photo: { type: 'string', format: 'binary' },
        delivery_receipt: { type: 'string', format: 'binary' },
      },
    },
  })
  uploadShipping(
    @Param('publicId') publicId: string,
    @UploadedFiles()
    files: { package_photo?: Express.Multer.File[]; delivery_receipt?: Express.Multer.File[] },
    @Body() body: { delivery_company?: string; tracking_number?: string; seller_note?: string },
    @CurrentActor() actor: RequestActor,
  ) {
    return this.shipping.uploadShippingProof(publicId, actor, body, {
      package_photo: files.package_photo?.[0],
      delivery_receipt: files.delivery_receipt?.[0],
    });
  }
}
