import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Bootstraps the platform admin from environment variables only.
 *
 * Why env-only: the system never exposes a way to register or
 * promote an admin from the HTTP API. Admins are operational
 * accounts owned by the platform owner, not self-service accounts.
 *
 * Behaviour:
 *   - On boot, if ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD
 *     are set, upsert a User row with role=ADMIN.
 *   - The password hash is refreshed every boot so rotating the
 *     env var rotates the password.
 *   - The `disabled` flag is reset to false to make sure the env
 *     admin can never be locked out by a previous admin action.
 */
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
    const adminName =
      this.cfg.get<string>('ADMIN_BOOTSTRAP_NAME') ?? 'BothSafe Admin';

    await this.prisma.user.upsert({
      where: { email },
      update: {
        role: 'ADMIN',
        disabled: false,
        passwordHash,
        emailVerified: true,
        name: adminName,
      },
      create: {
        email,
        passwordHash,
        name: adminName,
        role: 'ADMIN',
        disabled: false,
        emailVerified: true,
      },
    });
    this.logger.log(`Bootstrap admin user ensured: ${email}`);
  }
}
