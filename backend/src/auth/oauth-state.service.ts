import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

interface OAuthState {
  provider: 'telegram' | 'google';
  codeVerifier: string;
  redirectAfter?: string;
  createdAt: number;
}

/**
 * In-memory PKCE + CSRF state store for OAuth flows.
 * MVP: single-instance, no Redis needed.
 * TTL: 10 minutes per state entry.
 */
@Injectable()
export class OAuthStateService {
  private readonly store = new Map<string, OAuthState>();
  private readonly TTL_MS = 10 * 60 * 1000;

  /** Generate a cryptographically random state token. */
  private randomBase64Url(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  /** Derive code_challenge from a verifier using S256. */
  codeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  /**
   * Create a new state entry.
   * Returns { state, codeVerifier, codeChallenge }.
   */
  create(provider: 'telegram' | 'google', redirectAfter?: string) {
    this.pruneExpired();
    const state = this.randomBase64Url(24);
    const codeVerifier = this.randomBase64Url(48);
    this.store.set(state, {
      provider,
      codeVerifier,
      redirectAfter,
      createdAt: Date.now(),
    });
    return {
      state,
      codeVerifier,
      codeChallenge: this.codeChallenge(codeVerifier),
    };
  }

  /**
   * Consume a state entry (one-time use).
   * Throws BadRequestException if state is invalid or expired.
   */
  consume(state: string): OAuthState {
    const entry = this.store.get(state);
    if (!entry) {
      throw new BadRequestException({ messageKey: 'auth.invalid_state' });
    }
    this.store.delete(state);
    if (Date.now() - entry.createdAt > this.TTL_MS) {
      throw new BadRequestException({ messageKey: 'auth.state_expired' });
    }
    return entry;
  }

  private pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.createdAt > this.TTL_MS) {
        this.store.delete(key);
      }
    }
  }
}
