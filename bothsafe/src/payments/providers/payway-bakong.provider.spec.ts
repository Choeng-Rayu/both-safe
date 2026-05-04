import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { hmacSha256Hex } from '../../common/security/signature.util';
import { PayWayBakongProvider } from './payway-bakong.provider';

describe('PayWayBakongProvider', () => {
  const body = JSON.stringify({
    tran_id: 'payway-event-1',
    merchant_ref_no: 'deal-1',
    status: 'APPROVED',
  });
  const config = {
    get: (key: string) => (key === 'PAYWAY_WEBHOOK_SECRET' ? 'secret' : ''),
  } as ConfigService;

  it('accepts a valid HMAC webhook signature', async () => {
    const provider = new PayWayBakongProvider(config);
    const result = await provider.verifyWebhook({
      rawBody: body,
      parsedBody: JSON.parse(body) as Record<string, unknown>,
      headers: {
        'x-payway-signature': hmacSha256Hex('secret', body),
      },
    });

    expect(result.valid).toBe(true);
    expect(result.providerEventId).toBe('payway-event-1');
    expect(result.normalizedStatus).toBe(PaymentStatus.PAID);
  });

  it('rejects a spoofed webhook signature', async () => {
    const provider = new PayWayBakongProvider(config);
    const result = await provider.verifyWebhook({
      rawBody: body,
      parsedBody: JSON.parse(body) as Record<string, unknown>,
      headers: {
        'x-payway-signature': 'bad-signature',
      },
    });

    expect(result.valid).toBe(false);
  });
});
