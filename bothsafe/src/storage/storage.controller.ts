import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsString, IsUUID } from 'class-validator';
import { EntitlementService } from '../entitlements/entitlement.service';
import { StorageService } from './storage.service';

class CreateUploadUrlDto {
  @IsUUID()
  productId!: string;

  @IsString()
  filename!: string;

  @IsString()
  contentType!: string;
}

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Post('upload-url')
  createUploadUrl(@Body() body: CreateUploadUrlDto) {
    return this.storage.createUploadUrl(body);
  }

  @Get('download-url')
  async createDownloadUrl(
    @Query('storageKey') storageKey: string,
    @Query('userId') userId: string,
    @Query('productId') productId: string,
  ) {
    const access = await this.entitlements.canAccess(
      userId,
      productId,
      'download',
    );

    if (!access.allowed) {
      return access;
    }

    await this.entitlements.recordUsage({
      userId,
      productId,
      action: 'download_url_created',
    });

    return this.storage.createDownloadUrl(storageKey);
  }
}
