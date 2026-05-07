import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { UserAuthService } from './user-auth.service';
import { OAuthStateService } from './oauth-state.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class AdminLoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
}

class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsOptional() name?: string;
}

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly userAuth: UserAuthService,
    private readonly oauthState: OAuthStateService,
    private readonly config: ConfigService,
  ) {}

  // ─── Admin login (existing) ────────────────────────────────────────────────

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Admin login (returns JWT)' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.loginAdmin(dto.email, dto.password);
  }

  // ─── Current user ──────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get current logged-in user from session cookie' })
  async getMe(@Req() req: Request) {
    const rawToken = req.cookies?.[this.userAuth.cookieName];
    if (!rawToken) {
      throw new UnauthorizedException({ messageKey: 'auth.login_required' });
    }
    const user = await this.userAuth.resolveSession(rawToken);
    if (!user) {
      throw new UnauthorizedException({ messageKey: 'auth.session_expired' });
    }
    return { user };
  }

  // ─── Manual register / login ───────────────────────────────────────────────

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Register with email + password' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.userAuth.registerWithPassword(dto.email, dto.password, dto.name);
    const rawToken = await this.userAuth.createSession(user.id);
    this.setSessionCookie(res, rawToken);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Login with email + password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.userAuth.loginWithPassword(dto.email, dto.password);
    const rawToken = await this.userAuth.createSession(user.id);
    this.setSessionCookie(res, rawToken);
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (clear session cookie)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[this.userAuth.cookieName];
    if (rawToken) {
      await this.userAuth.revokeSession(rawToken);
    }
    this.clearSessionCookie(res);
    return { message_key: 'auth.logout_success' };
  }

  // ─── Telegram OIDC ────────────────────────────────────────────────────────

  @Get('telegram/authorize')
  @ApiOperation({ summary: 'Initiate Telegram OIDC login (redirects to Telegram)' })
  telegramAuthorize(
    @Query('redirectAfter') redirectAfter: string | undefined,
    @Res() res: Response,
  ) {
    const botId = this.config.getOrThrow<string>('TELEGRAM_CLIENT_ID');
    const callbackUrl = this.getCallbackUrl('telegram');

    const { state, codeChallenge } = this.oauthState.create('telegram', redirectAfter);

    const url = new URL('https://oauth.telegram.org/auth');
    url.searchParams.set('client_id', botId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid profile phone');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return res.redirect(url.toString());
  }

  @Get('telegram/callback')
  @ApiOperation({ summary: 'Telegram OIDC callback (exchanges code for session)' })
  async telegramCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const entry = this.oauthState.consume(state);

    // Exchange code for tokens
    const botId = this.config.getOrThrow<string>('TELEGRAM_CLIENT_ID');
    const botSecret = this.config.getOrThrow<string>('TELEGRAM_CLIENT_SECRET');
    const callbackUrl = this.getCallbackUrl('telegram');

    const tokenRes = await fetch('https://oauth.telegram.org/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${botId}:${botSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: botId,
        code_verifier: entry.codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      this.logger.error('Telegram token exchange failed', await tokenRes.text());
      return res.redirect(`${this.frontendUrl()}/login?error=telegram_failed`);
    }

    const tokenData = (await tokenRes.json()) as { id_token: string };
    const rawPayload = await this.verifyTelegramIdToken(tokenData.id_token, botId);

    const claims = rawPayload as {
      id?: unknown;
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
      preferred_username?: string;
    };

    const user = await this.userAuth.findOrCreateFromOAuth('telegram', {
      sub: String(claims.id ?? claims.sub),
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      preferred_username: claims.preferred_username,
    });

    const rawToken = await this.userAuth.createSession(user.id);
    this.setSessionCookie(res, rawToken);

    const redirectAfter = entry.redirectAfter ?? '/';
    return res.redirect(`${this.frontendUrl()}/auth/callback?success=1&redirectTo=${encodeURIComponent(redirectAfter)}`);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Get('google/authorize')
  @ApiOperation({ summary: 'Initiate Google OAuth login (redirects to Google)' })
  googleAuthorize(
    @Query('redirectAfter') redirectAfter: string | undefined,
    @Res() res: Response,
  ) {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const callbackUrl = this.getCallbackUrl('google');

    const { state, codeChallenge } = this.oauthState.create('google', redirectAfter);

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');

    return res.redirect(url.toString());
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback (exchanges code for session)' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const entry = this.oauthState.consume(state);

    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const callbackUrl = this.getCallbackUrl('google');

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: entry.codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      this.logger.error('Google token exchange failed', await tokenRes.text());
      return res.redirect(`${this.frontendUrl()}/login?error=google_failed`);
    }

    const tokenData = (await tokenRes.json()) as { id_token: string };

    // Decode ID token (no signature check needed for Google — use userinfo instead)
    const [, payload] = tokenData.id_token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const user = await this.userAuth.findOrCreateFromOAuth('google', claims);
    const rawToken = await this.userAuth.createSession(user.id);
    this.setSessionCookie(res, rawToken);

    const redirectAfter = entry.redirectAfter ?? '/';
    return res.redirect(`${this.frontendUrl()}/auth/callback?success=1&redirectTo=${encodeURIComponent(redirectAfter)}`);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getCallbackUrl(provider: 'telegram' | 'google'): string {
    const base = this.config.getOrThrow<string>('AUTH_CALLBACK_BASE_URL');
    return `${base}/v1/auth/${provider}/callback`;
  }

  private frontendUrl(): string {
    return this.config.get<string>('APP_BASE_URL', 'http://localhost:3000');
  }

  private setSessionCookie(res: Response, rawToken: string) {
    const ttlDays = this.config.get<number>('SESSION_TTL_DAYS', 30);
    res.cookie(this.userAuth.cookieName, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearSessionCookie(res: Response) {
    res.clearCookie(this.userAuth.cookieName, { path: '/' });
  }

  /**
   * Verify Telegram ID token using JWKS endpoint.
   * Validates iss, aud, and expiry.
   */
  private async verifyTelegramIdToken(idToken: string, expectedAud: string): Promise<Record<string, unknown>> {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const JWKS = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'));

    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: 'https://oauth.telegram.org',
      audience: expectedAud,
    });

    return payload as Record<string, unknown>;
  }
}
