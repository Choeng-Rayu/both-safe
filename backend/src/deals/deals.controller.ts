import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { JoinDealDto } from './dto/join-deal.dto';
import { UpdateDeliveryDto, UpdateParticipantDto, UpdatePayoutDto, UpdateProductDto } from './dto/update-sections.dto';
import { SellerAcceptDto } from './dto/seller-accept.dto';
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
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
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
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Counterparty joins via invite token' })
  join(@Param('publicId') publicId: string, @Body() dto: JoinDealDto, @CurrentActor() actor: RequestActor, @Req() req: Request) {
    const userId = (req as Request & { sessionUser?: { id: string } }).sessionUser?.id;
    return this.deals.joinDeal(publicId, dto, actor, userId);
  }

  @Patch(':publicId/sections/product')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  updateProduct(@Param('publicId') publicId: string, @Body() dto: UpdateProductDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateProduct(publicId, dto, actor);
  }

  @Patch(':publicId/sections/participant')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  updateParticipant(@Param('publicId') publicId: string, @Body() dto: UpdateParticipantDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateParticipant(publicId, dto, actor);
  }

  @Patch(':publicId/sections/payout')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  updatePayout(@Param('publicId') publicId: string, @Body() dto: UpdatePayoutDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updatePayout(publicId, dto, actor);
  }

  @Patch(':publicId/sections/delivery')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  updateDelivery(@Param('publicId') publicId: string, @Body() dto: UpdateDeliveryDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateDelivery(publicId, dto, actor);
  }

  @Post(':publicId/seller-accept')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Seller accepts deal and commits to ship' })
  sellerAccept(@Param('publicId') publicId: string, @Body() dto: SellerAcceptDto, @CurrentActor() actor: RequestActor) {
    return this.deals.sellerAccept(publicId, dto, actor);
  }

  @Post(':publicId/seller-reject')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Seller rejects deal (triggers refund)' })
  sellerReject(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.sellerReject(publicId, actor);
  }

  @Post(':publicId/cancel')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Buyer cancels deal before seller accepts' })
  cancel(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.buyerCancel(publicId, actor);
  }

  @Post(':publicId/confirm-received')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Buyer confirms product received and triggers automatic payout' })
  confirmReceived(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.confirmReceived(publicId, actor);
  }

  @Post(':publicId/approval')
  @UseGuards(UserSessionGuard, DealAccessGuard)
  @ApiOperation({ summary: 'Legacy approval endpoint — redirects to seller-accept' })
  approve(@Param('publicId') publicId: string, @Body() dto: SellerAcceptDto, @CurrentActor() actor: RequestActor) {
    return this.deals.sellerAccept(publicId, dto, actor);
  }
}
