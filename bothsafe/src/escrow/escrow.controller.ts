import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BuyerConfirmDto, CreateDealDto } from './dto';
import { EscrowService } from './escrow.service';

@Controller('deals')
export class EscrowController {
  constructor(private readonly escrow: EscrowService) {}

  @Get()
  listDeals() {
    return this.escrow.listDeals();
  }

  @Get(':id')
  getDeal(@Param('id') id: string) {
    return this.escrow.getDeal(id);
  }

  @Post()
  createDeal(@Body() body: CreateDealDto) {
    return this.escrow.createDigitalDeal(body);
  }

  @Post(':id/buyer-confirm')
  buyerConfirm(@Param('id') id: string, @Body() body: BuyerConfirmDto) {
    return this.escrow.buyerConfirm(id, body.buyerId);
  }

  @Post('jobs/auto-release-candidates')
  createAutoReleaseCandidates() {
    return this.escrow.createAutoReleaseCandidates();
  }
}
