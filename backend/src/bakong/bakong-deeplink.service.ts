import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BakongTokenService } from './bakong-token.service';
import { buildKHQR } from './khqr-builder';

export interface DeeplinkResult {
  deeplink: string;
  md5: string;
}

/**
 * Generates Bakong deeplinks for buyer-side payments. The seller payout
 * path no longer goes through here — released escrow funds land in the
 * seller's BothSafe wallet, and sellers cash out via /v1/withdrawals.
 */
@Injectable()
export class BakongDeeplinkService {
  private readonly logger = new Logger(BakongDeeplinkService.name);

  constructor(
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
    private readonly token: BakongTokenService,
  ) {}

  /**
   * Generate a Bakong deeplink for a given amount, currency, and bill reference.
   */
  async create(
    bankAccount: string,
    amount: number,
    currency: 'USD' | 'KHR',
    billNumber: string,
  ): Promise<DeeplinkResult> {
    const merchantName =
      this.cfg.get<string>('BAKONG_MERCHANT_NAME') ?? 'BothSafe';
    const merchantCity =
      this.cfg.get<string>('BAKONG_MERCHANT_CITY') ?? 'Phnom Penh';
    const appBaseUrl =
      this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
    const base =
      this.cfg.get<string>('BAKONG_BASE_URL') ??
      'https://api-bakong.nbc.gov.kh';

    const { qrString, md5 } = buildKHQR({
      bankAccount,
      merchantName,
      merchantCity,
      amount,
      currency,
      billNumber,
    });

    const tkn = this.token.get();
    if (!tkn) {
      // Fallback: return a Bakong universal deeplink without API call
      const fallbackDeeplink = `bakong://pay?qr=${encodeURIComponent(qrString)}`;
      this.logger.warn(
        `No Bakong token — using fallback deeplink format for ${billNumber}`,
      );
      return { deeplink: fallbackDeeplink, md5 };
    }

    try {
      const { data } = await firstValueFrom(
        this.http.post<{
          responseCode: number;
          responseMessage: string;
          data?: { shortLink: string };
        }>(
          `${base}/v1/generate_deeplink_by_qr`,
          {
            qr: qrString,
            sourceInfo: {
              appIconUrl: `${appBaseUrl}/logo.png`,
              appName: merchantName,
              appDeepLinkCallback: `${appBaseUrl}/bakong/callback`,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${tkn}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (data.responseCode !== 0 || !data.data?.shortLink) {
        throw new Error(`Bakong API error: ${data.responseMessage}`);
      }

      return { deeplink: data.data.shortLink, md5 };
    } catch (err) {
      this.logger.error('Bakong deeplink API failed, using fallback', err);
      return {
        deeplink: `bakong://pay?qr=${encodeURIComponent(qrString)}`,
        md5,
      };
    }
  }
}
