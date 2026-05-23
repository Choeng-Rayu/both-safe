jest.mock('nanoid', () => ({
  customAlphabet: () => () =>
    Array.from(
      { length: 10 },
      () => '23456789abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 31)],
    ).join(''),
}));

import {
  generateOpaqueToken,
  generatePublicId,
  hashToken,
  compareToken,
} from './tokens';

describe('TokenService (Kiro spec)', () => {
  describe('token generation', () => {
    it('should generate unique tokens', () => {
      const token1 = generateOpaqueToken();
      const token2 = generateOpaqueToken();
      expect(token1).not.toEqual(token2);
    });

    it('should generate tokens of expected length (base64url of 32 bytes = 43 chars)', () => {
      const token = generateOpaqueToken();
      expect(token.length).toBe(43);
    });

    it('should generate different token lengths based on byteLength param', () => {
      const token16 = generateOpaqueToken(16);
      const token32 = generateOpaqueToken(32);
      expect(token16.length).toBeLessThan(token32.length);
    });
  });

  describe('public ID generation', () => {
    it('should generate public IDs of length 10', () => {
      const id = generatePublicId();
      expect(id.length).toBe(10);
    });

    it('should generate URL-safe public IDs', () => {
      const id = generatePublicId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate unique public IDs', () => {
      const ids = new Set(
        Array.from({ length: 100 }, () => generatePublicId()),
      );
      expect(ids.size).toBe(100);
    });
  });

  describe('token hashing', () => {
    it('should hash tokens securely (SHA-256 hex = 64 chars)', () => {
      const token = generateOpaqueToken();
      const hash = hashToken(token);
      expect(hash.length).toBe(64);
      expect(hash).not.toEqual(token);
    });

    it('should produce consistent hashes for same input', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toEqual(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');
      expect(hash1).not.toEqual(hash2);
    });
  });

  describe('token comparison', () => {
    it('should validate correct tokens', () => {
      const token = generateOpaqueToken();
      const hash = hashToken(token);
      expect(compareToken(token, hash)).toBe(true);
    });

    it('should reject incorrect tokens', () => {
      const hash = hashToken('correct-token');
      expect(compareToken('wrong-token', hash)).toBe(false);
    });

    it('should reject empty tokens', () => {
      const hash = hashToken('valid-token');
      expect(compareToken('', hash)).toBe(false);
    });
  });
});
