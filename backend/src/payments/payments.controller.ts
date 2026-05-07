import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { DealAccessGuard } from '../auth/guards/deal-access.guard';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('deals/:publicId')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payment-instruction')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Get or create KHQR payment intent for automatic Bakong verification' })
  instruction(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.payments.paymentInstruction(publicId, actor);
  }

  @Post('payment-proofs')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @UseInterceptors(FileInterceptor('proof_image', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Buyer optionally uploads a payment receipt for an automatic payment intent' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        proof_image: { type: 'string', format: 'binary' },
        paid_amount: { type: 'number' },
        buyer_note: { type: 'string' },
        idempotency_key: { type: 'string' },
      },
      required: [],
    },
  })
  uploadProof(
    @Param('publicId') publicId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPaymentProofDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.payments.uploadProof(publicId, file, dto, actor);
  }
}
