import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { PaymentsService } from '../payments/payments.service';
import { RejectPaymentDto } from '../payments/dto/upload-payment-proof.dto';

class ReleaseDto {
  @IsString() @MaxLength(120) payout_reference!: string;
  @IsOptional() @IsString() @MaxLength(2000) admin_note?: string;
  @IsOptional() @IsString() @MaxLength(120) idempotency_key?: string;
}
class RefundDto {
  @IsString() @MaxLength(120) refund_reference!: string;
  @IsOptional() @IsString() @MaxLength(2000) admin_note?: string;
  @IsOptional() @IsString() @MaxLength(120) idempotency_key?: string;
}
class NoteDto {
  @IsString() @MaxLength(2000) note!: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('deals')
  @ApiOperation({ summary: 'List deals (filter by status)' })
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.admin.listDeals({ status, page, pageSize });
  }

  @Get('deals/:dealId')
  @ApiOperation({ summary: 'Inspect deal detail (admin)' })
  detail(@Param('dealId') dealId: string) {
    return this.admin.getDeal(dealId);
  }

  @Get('deals/:dealId/audit-log')
  @ApiOperation({ summary: 'Audit log of a deal' })
  audit(@Param('dealId') dealId: string) {
    return this.admin.auditLog(dealId);
  }

  @Get('payment-proofs/pending')
  @ApiOperation({ summary: 'List payments awaiting admin verification' })
  pending() {
    return this.admin.listPendingPayments();
  }

  @Post('payment-proofs/:paymentId/verify')
  @ApiOperation({ summary: 'Mark a payment proof verified' })
  verify(@Param('paymentId') paymentId: string, @Req() req: any) {
    return this.payments.adminVerify(paymentId, req.actor.adminId);
  }

  @Post('payment-proofs/:paymentId/reject')
  @ApiOperation({ summary: 'Reject a payment proof' })
  reject(@Param('paymentId') paymentId: string, @Body() dto: RejectPaymentDto, @Req() req: any) {
    return this.payments.adminReject(paymentId, dto.reason, req.actor.adminId);
  }

  @Post('deals/:dealId/release')
  @ApiOperation({ summary: 'Release escrow → seller payout' })
  release(@Param('dealId') dealId: string, @Body() dto: ReleaseDto, @Req() req: any) {
    return this.admin.release(dealId, dto, req.actor.adminId);
  }

  @Post('deals/:dealId/refund')
  @ApiOperation({ summary: 'Refund buyer' })
  refund(@Param('dealId') dealId: string, @Body() dto: RefundDto, @Req() req: any) {
    return this.admin.refund(dealId, dto, req.actor.adminId);
  }

  @Post('deals/:dealId/notes')
  @ApiOperation({ summary: 'Add internal admin note (audit log)' })
  note(@Param('dealId') dealId: string, @Body() dto: NoteDto, @Req() req: any) {
    return this.admin.addNote(dealId, dto.note, req.actor.adminId);
  }
}
