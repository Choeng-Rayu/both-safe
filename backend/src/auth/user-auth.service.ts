import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface OAuthClaims {
  sub: string;           // unique provider user ID
  email?: string;
  name?: string;
  picture?: string;      // avatar URL
  preferred_username?: string;
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
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

    // 3. Create new user if needed
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: email ?? null,
          name: name ?? claims.preferred_username ?? null,
          avatarUrl: picture ?? null,
          emailVerified: provider === 'google', // Google verifies email
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
      data: { email, passwordHash, name: name ?? null, emailVerified: false },
    });
    return this.toSessionUser(user);
  }

  async loginWithPassword(email: string, password: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({ messageKey: 'auth.invalid_credentials' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ messageKey: 'auth.invalid_credentials' });
    }
    return this.toSessionUser(user);
  }

  // ─── Session management ───────────────────────────────────────────────────

  /** Create a session and return the raw token (set as cookie by controller). */
  async createSession(
    userId: string,
    ttlDays = 30,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawToken;
  }

  /** Resolve a raw session token → SessionUser. Returns null if invalid/expired. */
  async resolveSession(rawToken: string): Promise<SessionUser | null> {
    if (!rawToken) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return this.toSessionUser(session.user);
  }

  /** Revoke a session (logout). */
  async revokeSession(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.userSession
      .delete({ where: { tokenHash } })
      .catch(() => {}); // ignore if not found
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toSessionUser(user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
  }): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
    };
  }
}
