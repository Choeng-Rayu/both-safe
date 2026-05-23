import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OAuthClaims {
  sub: string; // unique provider user ID
  email?: string;
  name?: string;
  picture?: string; // avatar URL
  preferred_username?: string;
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  role: UserRole;
  disabled: boolean;
}

const SESSION_COOKIE = 'bothsafe_session';
const SALT_ROUNDS = 12;

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);
  readonly cookieName = SESSION_COOKIE;

  constructor(private readonly prisma: PrismaService) {}

  // ─── OAuth ────────────────────────────────────────────────────────────────

  /**
   * Find-or-create a User from OAuth ID token claims.
   * Links the OAuthAccount to the User row.
   *
   * Disabled accounts are rejected here so a banned user cannot
   * sign back in via Google/Telegram. Admin role can never be
   * granted by an OAuth signup — new users are always USER.
   */
  async findOrCreateFromOAuth(
    provider: 'telegram' | 'google',
    claims: OAuthClaims,
  ): Promise<SessionUser> {
    const { sub, email, name, picture } = claims;

    // 1. Check for existing OAuth link
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerSub: { provider, providerSub: sub } },
      include: { user: true },
    });

    if (existing) {
      this.assertNotDisabled(existing.user);
      // Update profile fields that might have changed
      await this.prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: {
          email: email ?? existing.email,
          name: name ?? existing.name,
          avatarUrl: picture ?? existing.avatarUrl,
          updatedAt: new Date(),
        },
      });
      return this.toSessionUser(existing.user);
    }

    // 2. Try to match by email (merge accounts)
    let user = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;

    if (user) {
      this.assertNotDisabled(user);
    }

    // 3. Create new user if needed
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: email ?? null,
          name: name ?? claims.preferred_username ?? null,
          avatarUrl: picture ?? null,
          emailVerified: provider === 'google', // Google verifies email
          // OAuth signups are always regular users.
          role: 'USER',
        },
      });
    }

    // 4. Create OAuthAccount link
    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerSub: sub,
        email: email ?? null,
        name: name ?? null,
        avatarUrl: picture ?? null,
      },
    });

    return this.toSessionUser(user);
  }

  // ─── Password auth ────────────────────────────────────────────────────────

  async registerWithPassword(
    email: string,
    password: string,
    name?: string,
  ): Promise<SessionUser> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({ messageKey: 'auth.email_taken' });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
        emailVerified: false,
        // Admins are only created via SeedService from environment
        // variables. The HTTP register endpoint must never produce
        // an admin row.
        role: 'USER',
      },
    });
    return this.toSessionUser(user);
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        messageKey: 'auth.invalid_credentials',
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        messageKey: 'auth.invalid_credentials',
      });
    }
    this.assertNotDisabled(user);
    return this.toSessionUser(user);
  }

  // ─── Session management ───────────────────────────────────────────────────

  /** Create a session and return the raw token (set as cookie by controller). */
  async createSession(userId: string, ttlDays = 30): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawToken;
  }

  /**
   * Resolve a raw session token → SessionUser. Returns null if
   * invalid, expired, or the underlying user has been disabled.
   * Disabled-account rejection happens here so a previously valid
   * session is invalidated as soon as the admin flips the flag.
   */
  async resolveSession(rawToken: string): Promise<SessionUser | null> {
    if (!rawToken) return null;
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.prisma.userSession
        .delete({ where: { id: session.id } })
        .catch(() => {});
      return null;
    }

    if (session.user.disabled) {
      // Disabled account → kill the session.
      await this.prisma.userSession
        .delete({ where: { id: session.id } })
        .catch(() => {});
      return null;
    }

    return this.toSessionUser(session.user);
  }

  /** Revoke a session (logout). */
  async revokeSession(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    await this.prisma.userSession
      .delete({ where: { tokenHash } })
      .catch(() => {}); // ignore if not found
  }

  /** Revoke every session belonging to a user. Called when an admin disables an account. */
  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({ where: { userId } });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private assertNotDisabled(user: { disabled: boolean }) {
    if (user.disabled) {
      throw new ForbiddenException({ messageKey: 'auth.account_disabled' });
    }
  }

  private toSessionUser(user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    role: UserRole;
    disabled: boolean;
  }): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      role: user.role,
      disabled: user.disabled,
    };
  }
}
