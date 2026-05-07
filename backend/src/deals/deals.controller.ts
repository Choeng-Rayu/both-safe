import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { JoinDealDto } from './dto/join-deal.dto';
import { UpdateDeliveryDto, UpdateParticipantDto, UpdatePayoutDto, UpdateProductDto } from './dto/update-sections.dto';
import { SellerAcceptDto } from './dto/seller-accept.dto';
import { DealAccessGuard } from '../auth/guards/deal-access.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { UserAuthService } from '../auth/user-auth.service';
import type { Request } from 'express';

@ApiTags('deals')
@Controller('deals')
export class DealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly userAuth: UserAuthService,
  ) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Create deal (web or telegram source)' })
  async create(@Body() dto: CreateDealDto, @Req() req: Request) {
    // Resolve user session to link deal to account (optional — anonymous creation still works)
    const rawToken = req.cookies?.[this.userAuth.cookieName];
    let userId: string | undefined;
    if (rawToken) {
      const user = await this.userAuth.resolveSession(rawToken);
      userId = user?.id;
    }
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
  join(@Param('publicId') publicId: string, @Body() dto: JoinDealDto, @CurrentActor() actor: RequestActor) {
    return this.deals.joinDeal(publicId, dto, actor);
  }

  @Patch(':publicId/sections/product')
  @UseGuards(DealAccessGuard)
  updateProduct(@Param('publicId') publicId: string, @Body() dto: UpdateProductDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateProduct(publicId, dto, actor);
  }

  @Patch(':publicId/sections/participant')
  @UseGuards(DealAccessGuard)
  updateParticipant(@Param('publicId') publicId: string, @Body() dto: UpdateParticipantDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateParticipant(publicId, dto, actor);
  }

  @Patch(':publicId/sections/payout')
  @UseGuards(DealAccessGuard)
  updatePayout(@Param('publicId') publicId: string, @Body() dto: UpdatePayoutDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updatePayout(publicId, dto, actor);
  }

  @Patch(':publicId/sections/delivery')
  @UseGuards(DealAccessGuard)
  updateDelivery(@Param('publicId') publicId: string, @Body() dto: UpdateDeliveryDto, @CurrentActor() actor: RequestActor) {
    return this.deals.updateDelivery(publicId, dto, actor);
  }

  @Post(':publicId/seller-accept')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Seller accepts deal and commits to ship' })
  sellerAccept(@Param('publicId') publicId: string, @Body() dto: SellerAcceptDto, @CurrentActor() actor: RequestActor) {
    return this.deals.sellerAccept(publicId, dto, actor);
  }

  @Post(':publicId/seller-reject')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Seller rejects deal (triggers refund)' })
  sellerReject(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.sellerReject(publicId, actor);
  }

  @Post(':publicId/cancel')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Buyer cancels deal before seller accepts' })
  cancel(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.buyerCancel(publicId, actor);
  }

  @Post(':publicId/confirm-received')
@UseGuards(DealAccessGuard)
@ApiOperation({ summary: 'Buyer confirms product received — triggers release pending' })
confirmReceived(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
  return this.deals.confirmReceived(publicId, actor);
}

@Post(':publicId/approval')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Legacy approval endpoint — redirects to seller-accept' })
  approve(@Param('publicId') publicId: string, @Body() dto: SellerAcceptDto, @CurrentActor() actor: RequestActor) {
    return this.deals.sellerAccept(publicId, dto, actor);
  }
}
