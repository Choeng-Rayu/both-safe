import * as crypto from 'crypto';

export interface KHQRParams {
  bankAccount: string; // Bakong account ID e.g. "seller@aba"
  merchantName: string;
  merchantCity: string;
  amount: number;
  currency: 'USD' | 'KHR';
  billNumber: string; // max 25 chars — use deal publicId
}

/**
 * Builds a KHQR string and its MD5 hash for use with the Bakong Deeplink API.
 * This implements the EMV QR code spec used by Bakong (NBC Cambodia).
 */
export function buildKHQR(p: KHQRParams): { qrString: string; md5: string } {
  const tlv = (tag: string, v: string) =>
    `${tag}${v.length.toString().padStart(2, '0')}${v}`;

  const parts = [
    tlv('00', '01'),
    tlv('01', '12'),
    tlv('29', tlv('00', 'bakong.gov.kh') + tlv('01', p.bankAccount)),
    tlv('52', '5999'),
    tlv('53', p.currency === 'USD' ? '840' : '116'),
    ...(p.amount > 0
      ? [tlv('54', p.amount.toFixed(p.currency === 'KHR' ? 0 : 2))]
      : []),
    tlv('58', 'KH'),
    tlv('59', p.merchantName.slice(0, 25)),
    tlv('60', p.merchantCity.slice(0, 15)),
    tlv('62', tlv('01', p.billNumber.slice(0, 25))),
    '6304',
  ];

  const raw = parts.join('');

  // CRC-16/CCITT-FALSE
  let crc = 0xffff;
  for (let i = 0; i < raw.length; i++) {
    crc ^= raw.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  const qrString = raw + crc.toString(16).padStart(4, '0').toUpperCase();
  return {
    qrString,
    md5: crypto.createHash('md5').update(qrString).digest('hex'),
  };
}
