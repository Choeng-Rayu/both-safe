import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AddDisputeMessageDto, OpenDisputeDto } from './dto';
import { DisputeService } from './dispute.service';

@Controller()
export class DisputeController {
  constructor(private readonly disputes: DisputeService) {}

  @Get('disputes')
  listDisputes() {
    return this.disputes.listDisputes();
  }

  @Post('deals/:dealId/disputes')
  openDispute(@Param('dealId') dealId: string, @Body() body: OpenDisputeDto) {
    return this.disputes.openDispute({
      dealId,
      openedById: body.openedById,
      reason: body.reason,
    });
  }

  @Post('disputes/:id/messages')
  addMessage(@Param('id') id: string, @Body() body: AddDisputeMessageDto) {
    return this.disputes.addMessage({
      disputeId: id,
      ...body,
    });
  }
}
