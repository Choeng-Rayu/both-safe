import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { JoinDealDto } from './dto/join-deal.dto';
import {
  UpdateDeliveryDto,
  UpdateParticipantDto,
  UpdatePayoutDto,
  UpdateProductDto,
} from './dto/update-sections.dto';
import { DealAccessGuard } from '../auth/guards/deal-access.guard';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import type { RequestActor } from '../common/decorators/current-actor.decorator';

@ApiTags('deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Create deal (web or telegram source)' })
  create(@Body() dto: CreateDealDto) {
    return this.deals.createDeal(dto);
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
  join(
    @Param('publicId') publicId: string,
    @Body() dto: JoinDealDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.deals.joinDeal(publicId, dto, actor);
  }

  @Patch(':publicId/sections/product')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Update product / price section' })
  updateProduct(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateProductDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.deals.updateProduct(publicId, dto, actor);
  }

  @Patch(':publicId/sections/participant')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Update current actor participant fields' })
  updateParticipant(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateParticipantDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.deals.updateParticipant(publicId, dto, actor);
  }

  @Patch(':publicId/sections/payout')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Update seller payout info (seller only)' })
  updatePayout(
    @Param('publicId') publicId: string,
    @Body() dto: UpdatePayoutDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.deals.updatePayout(publicId, dto, actor);
  }

  @Patch(':publicId/sections/delivery')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Update delivery preferences (reserved)' })
  updateDelivery(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateDeliveryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.deals.updateDelivery(publicId, dto, actor);
  }

  @Post(':publicId/approval')
  @UseGuards(DealAccessGuard)
  @ApiOperation({ summary: 'Approve deal (buyer or seller)' })
  approve(@Param('publicId') publicId: string, @CurrentActor() actor: RequestActor) {
    return this.deals.approve(publicId, actor);
  }
}
