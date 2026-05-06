import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.cfg.get<string>('SKIP_BOOTSTRAP_SEED') === '1') return;
    const email = this.cfg.get<string>('ADMIN_BOOTSTRAP_EMAIL');
    const password = this.cfg.get<string>('ADMIN_BOOTSTRAP_PASSWORD');
    if (!email || !password) return;

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.admin.upsert({
      where: { email },
      update: {
        active: true,
      },
      create: {
        email,
        passwordHash,
        name: 'BothSafe Admin',
        active: true,
      },
    });
    this.logger.log(`Bootstrap admin ensured: ${email}`);
  }
}
