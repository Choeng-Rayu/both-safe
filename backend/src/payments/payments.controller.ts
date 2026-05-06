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
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('deals/:publicId')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payment-instruction')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Get KHQR payment instruction (visible after READY_FOR_PAYMENT)' })
  instruction(@Param('publicId') publicId: string) {
    return this.payments.paymentInstruction(publicId);
  }

  @Post('payment-proofs')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(DealAccessGuard)
  @UseInterceptors(FileInterceptor('proof_image', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Buyer uploads payment proof' })
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
      required: ['proof_image', 'paid_amount'],
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
