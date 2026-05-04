import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdminDecisionDto } from './dto';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('review-queue')
  reviewQueue() {
    return this.admin.listReviewQueue();
  }

  @Post('deals/:dealId/decision')
  decideDeal(@Param('dealId') dealId: string, @Body() body: AdminDecisionDto) {
    return this.admin.decideDeal({ dealId, ...body });
  }
}
