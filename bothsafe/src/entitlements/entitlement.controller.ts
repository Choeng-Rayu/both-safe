import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsString, IsUUID } from 'class-validator';
import { EntitlementService } from './entitlement.service';

class RecordUsageDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  productId!: string;

  @IsString()
  action!: string;
}

@Controller('entitlements')
export class EntitlementController {
  constructor(private readonly entitlements: EntitlementService) {}

  @Get('access')
  canAccess(
    @Query('userId') userId: string,
    @Query('productId') productId: string,
    @Query('action') action = 'download',
  ) {
    return this.entitlements.canAccess(userId, productId, action);
  }

  @Post('usage')
  recordUsage(@Body() body: RecordUsageDto) {
    return this.entitlements.recordUsage(body);
  }
}
