import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { DealAccessGuard } from '../auth/guards/deal-access.guard';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { DisputesService } from './disputes.service';

@ApiTags('disputes')
@Controller('deals/:publicId/disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @UseInterceptors(
    FilesInterceptor('evidence_files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Open a dispute' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: [
            'ITEM_NOT_RECEIVED',
            'WRONG_ITEM',
            'DAMAGED_ITEM',
            'FAKE_ITEM',
            'PAYMENT_PROBLEM',
            'OTHER',
          ],
        },
        message: { type: 'string' },
        evidence_files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['reason', 'message'],
    },
  })
  open(
    @Param('publicId') publicId: string,
    @Body() body: { reason: string; message: string },
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.disputes.openDispute(publicId, actor, body, files ?? []);
  }
}
