import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbOk = true;
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      dbOk = false;
    }
    return {
      status: dbOk ? 'ok' : 'degraded',
      uptime_s: Math.floor(process.uptime()),
      db: dbOk,
      now: new Date().toISOString(),
    };
  }
}
