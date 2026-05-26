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

  @Get('stats')
  @ApiOperation({
    summary:
      'High-level admin dashboard counters: users, deals, wallets, withdrawals, feedback',
  })
  stats() {
    return this.admin.overviewStats();
  }

  @Get('deals')
  @ApiOperation({ summary: 'List deals with filters and pagination' })
  list(
    @Query('status') status?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listDeals({
      status,
      from_date,
      to_date,
      search,
      page,
      pageSize,
    });
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
  reject(
    @Param('paymentId') paymentId: string,
    @Body() dto: RejectPaymentDto,
    @Req() req: any,
  ) {
    return this.payments.adminReject(paymentId, dto.reason, req.actor.adminId);
  }

  @Post('deals/:dealId/release')
  @ApiOperation({ summary: 'Release escrow → seller payout' })
  release(
    @Param('dealId') dealId: string,
    @Body() dto: ReleaseDto,
    @Req() req: any,
  ) {
    return this.admin.release(dealId, dto, req.actor.adminId);
  }

  @Post('deals/:dealId/refund')
  @ApiOperation({ summary: 'Refund buyer' })
  refund(
    @Param('dealId') dealId: string,
    @Body() dto: RefundDto,
    @Req() req: any,
  ) {
    return this.admin.refund(dealId, dto, req.actor.adminId);
  }

  @Post('disputes/:disputeId/resolve')
  @ApiOperation({ summary: 'Resolve a dispute (release or refund)' })
  resolveDispute(
    @Param('disputeId') disputeId: string,
    @Body()
    dto: {
      decision: 'release' | 'refund';
      admin_note?: string;
      payout_reference?: string;
      refund_reference?: string;
    },
    @Req() req: any,
  ) {
    return this.admin.resolveDispute(disputeId, dto, req.actor.adminId);
  }

  @Post('deals/:dealId/notes')
  @ApiOperation({ summary: 'Add internal admin note (audit log)' })
  note(@Param('dealId') dealId: string, @Body() dto: NoteDto, @Req() req: any) {
    return this.admin.addNote(dealId, dto.note, req.actor.adminId);
  }

  @Get('payment-proofs/:paymentId/check-bakong')
  @ApiOperation({
    summary: 'Check Bakong transaction by MD5 (confirm real payment received)',
  })
  checkBakong(@Param('paymentId') paymentId: string) {
    return this.admin.checkBakongByPaymentId(paymentId, this.payments);
  }

  @Get('feedback')
  @ApiOperation({
    summary: 'List user-submitted deal feedback (rating + optional comment)',
  })
  listFeedback(
    @Query('minRating') minRating?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listFeedback({ minRating, role, page, pageSize });
  }
}
