import { createHash, randomBytes } from 'crypto';
import { customAlphabet } from 'nanoid';

const publicIdAlphabet = '23456789abcdefghjkmnpqrstuvwxyz';
const publicIdGen = customAlphabet(publicIdAlphabet, 10);

export function generatePublicId(): string {
  return publicIdGen();
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function compareToken(token: string, hash: string): boolean {
  return hashToken(token) === hash;
}
