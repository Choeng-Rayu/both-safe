import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { DealAccessGuard } from '../auth/guards/deal-access.guard';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import { PaymentsService } from './payments.service';

interface AuthedRequest extends Request {
  sessionUser?: { id: string };
}

@ApiTags('payments')
@Controller('deals/:publicId')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/wallet')
  @UseGuards(UserSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Buyer pays this deal from their BothSafe wallet' })
  payFromWallet(
    @Param('publicId') publicId: string,
    @Req() req: AuthedRequest,
  ) {
    const userId = req.sessionUser?.id;
    if (!userId) {
      throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    }
    return this.payments.payFromWallet(publicId, userId);
  }

  @Get('payment-instruction')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({
    summary:
      'Get or create KHQR payment intent for automatic Bakong verification',
  })
  instruction(
    @Param('publicId') publicId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.payments.paymentInstruction(publicId, actor);
  }

  @Post('payment-instruction/regenerate')
  // 5/min was too tight in practice — the buyer might tap "Generate
  // KHQR" several times if the first attempt looked like nothing
  // happened, and our existing GET endpoint already self-heals on
  // each fetch. 30/min is plenty of head-room without being abusive.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({
    summary:
      'Discard the current pending KHQR intent and issue a fresh one (buyer-only)',
  })
  regenerateInstruction(
    @Param('publicId') publicId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.payments.regeneratePaymentInstruction(publicId, actor);
  }

  @Post('payment-proofs')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @UseInterceptors(
    FileInterceptor('proof_image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary:
      'Buyer optionally uploads a payment receipt for an automatic payment intent',
  })
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
