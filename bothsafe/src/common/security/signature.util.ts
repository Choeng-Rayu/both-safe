import { createHash, createHmac, createVerify, timingSafeEqual } from 'crypto';

export type HeaderValue = string | string[] | undefined;

export function headerToString(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256Hex(
  secret: string,
  payload: string | Buffer,
): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function hmacSha512Hex(
  secret: string,
  payload: string | Buffer,
): string {
  return createHmac('sha512', secret)
    .update(payload)
    .digest('hex')
    .toUpperCase();
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyRsaSha256Signature(
  publicKey: string,
  payload: string | Buffer,
  signatureBase64: string,
): boolean {
  const verifier = createVerify('RSA-SHA256');
  verifier.update(payload);
  verifier.end();

  return verifier.verify(publicKey, signatureBase64, 'base64');
}
