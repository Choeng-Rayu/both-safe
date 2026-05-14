import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { JoinDealDto } from './dto/join-deal.dto';
import { UpdateDeliveryDto, UpdateParticipantDto, UpdatePayoutDto, UpdateProductDto } from './dto/update-sections.dto';
import { DealAccessGuard } from '../auth/guards/deal-access.guard';
import { UserSessionGuard } from '../auth/guards/user-session.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import type { Request } from 'express';

@ApiTags('deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(UserSessionGuard)
  @ApiOperation({ summary: 'Create deal (web or telegram source)' })
  async create(@Body() dto: CreateDealDto, @Req() req: Request) {
    const userId = (req as Request & { sessionUser?: { id: string } }).sessionUser?.id;
    return this.deals.createDeal(dto, userId);
  }

  @Get(':publicId')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Get deal room state' })
  get(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.getDeal(publicId, actor);
  }

  @Post(':publicId/join')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Counterparty joins via invite token' })
  join(@Param('publicId') publicId: string, @Body() dto: JoinDealDto, @CurrentActor() actor: RequestActor, @Req() req: Request) {
    const userId = (req as Request & { sessionUser?: { id: string } }).sessionUser?.id;
    return this.deals.joinDeal(publicId, dto, actor, userId);
  }

  @Patch(':publicId/sections/product')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Update product details' })
  updateProduct(@Param('publicId') publicId: string, @Body() dto: UpdateProductDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateProduct(publicId, dto, actor);
  }

  @Patch(':publicId/sections/participant')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Update participant info (name, phone)' })
  updateParticipant(@Param('publicId') publicId: string, @Body() dto: UpdateParticipantDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateParticipant(publicId, dto, actor);
  }

  @Patch(':publicId/sections/payout')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Update seller payout details (KHQR, bank info)' })
  updatePayout(@Param('publicId') publicId: string, @Body() dto: UpdatePayoutDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updatePayout(publicId, dto, actor);
  }

  @Patch(':publicId/sections/delivery')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Update delivery information' })
  updateDelivery(@Param('publicId') publicId: string, @Body() dto: UpdateDeliveryDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateDelivery(publicId, dto, actor);
  }

  @Post(':publicId/approval')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Participant approves deal terms' })
  approve(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.approveDeal(publicId, actor);
  }

  @Post(':publicId/cancel')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Buyer cancels deal before approval' })
  cancel(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.buyerCancel(publicId, actor);
  }

  @Post(':publicId/confirm-received')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Buyer confirms product received' })
  confirmReceived(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.confirmReceived(publicId, actor);
  }
}
