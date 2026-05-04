import { generateKeyPairSync, createSign } from 'crypto';
import {
  hmacSha256Hex,
  timingSafeStringEqual,
  verifyRsaSha256Signature,
} from './signature.util';

describe('signature utilities', () => {
  it('compares HMAC values safely', () => {
    const expected = hmacSha256Hex('secret', '{"ok":true}');

    expect(timingSafeStringEqual(expected, expected)).toBe(true);
    expect(timingSafeStringEqual(expected, 'bad')).toBe(false);
  });

  it('verifies RSA SHA256 signatures and rejects tampered payloads', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const payload = 'timestamp\nnonce\n{"status":"PAY_SUCCESS"}\n';
    const signer = createSign('RSA-SHA256');
    signer.update(payload);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    const publicKeyPem = publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;

    expect(verifyRsaSha256Signature(publicKeyPem, payload, signature)).toBe(
      true,
    );
    expect(
      verifyRsaSha256Signature(publicKeyPem, `${payload}tampered`, signature),
    ).toBe(false);
  });
});
