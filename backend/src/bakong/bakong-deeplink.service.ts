import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { BakongTokenService } from './bakong-token.service';
import { buildKHQR } from './khqr-builder';

export interface DeeplinkResult {
  deeplink: string;
  md5: string;
}

export interface PayoutDeeplinkResult extends DeeplinkResult {
  seller_name: string | null;
  seller_payout_method: 'khqr_id' | 'bank_account' | 'khqr_image' | 'none';
  seller_bank_name: string | null;
  seller_account_name: string | null;
  seller_account_number: string | null;
  seller_khqr: string | null;
  seller_khqr_image: string | null;
  amount: number;
  currency: string;
  deal_public_id: string;
}

/**
 * Generates Bakong deeplinks for the admin to open in their Bakong app.
 * The deeplink pre-fills the recipient (seller) and amount so admin
 * just needs to confirm the payment in their Bakong app.
 *
 * NOTE: This sends money FROM the admin/BothSafe Bakong account TO the seller.
 * The admin must be logged into Bakong on their phone as the BothSafe account.
 */
@Injectable()
export class BakongDeeplinkService {
  private readonly logger = new Logger(BakongDeeplinkService.name);

  constructor(
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
    private readonly token: BakongTokenService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate a Bakong deeplink for a given amount, currency, and bill reference.
   * Uses the seller's Bakong account ID or the BothSafe receiving account as fallback.
   */
  async create(
    bankAccount: string,
    amount: number,
    currency: 'USD' | 'KHR',
    billNumber: string,
  ): Promise<DeeplinkResult> {
    const merchantName = this.cfg.get<string>('BAKONG_MERCHANT_NAME') ?? 'BothSafe';
    const merchantCity = this.cfg.get<string>('BAKONG_MERCHANT_CITY') ?? 'Phnom Penh';
    const appBaseUrl = this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
    const base = this.cfg.get<string>('BAKONG_BASE_URL') ?? 'https://api-bakong.nbc.gov.kh';

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
      // Format: bakong://pay?qr=<qrString>
      const fallbackDeeplink = `bakong://pay?qr=${encodeURIComponent(qrString)}`;
      this.logger.warn(`No Bakong token — using fallback deeplink format for ${billNumber}`);
      return { deeplink: fallbackDeeplink, md5 };
    }

    try {
      const { data } = await firstValueFrom(
        this.http.post<{ responseCode: number; responseMessage: string; data?: { shortLink: string } }>(
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
      // Fallback to raw KHQR deeplink
      return {
        deeplink: `bakong://pay?qr=${encodeURIComponent(qrString)}`,
        md5,
      };
    }
  }

  /**
   * Generate a payout deeplink for admin to send money to the seller of a deal.
   * Reads seller payout info from the database and builds the appropriate deeplink.
   */
  async generatePayoutDeeplink(dealId: string): Promise<PayoutDeeplinkResult> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true, product: true },
    });
    if (!deal) throw new NotFoundException({ messageKey: 'deal.not_found' });

    const seller = deal.participants.find((p) => p.role === 'seller');
    const amount = deal.netSellerAmount ?? deal.amount ?? 0;
    const currency = (deal.currency === 'KHR' ? 'KHR' : 'USD') as 'USD' | 'KHR';

    // Determine seller's payout method and Bakong account
    const khqrId = seller?.payoutKhqr;
    const hasBankAccount = !!(seller?.payoutBankName && seller?.payoutAccountNumber);
    const hasKhqrImage = !!seller?.payoutKhqrImage;

    let sellerPayoutMethod: PayoutDeeplinkResult['seller_payout_method'] = 'none';
    let deeplinkResult: DeeplinkResult;

    if (khqrId) {
      // Seller provided a Bakong ID — generate deeplink pointing to their account
      sellerPayoutMethod = 'khqr_id';
      deeplinkResult = await this.create(khqrId, amount, currency, `BS-${deal.publicId}`);
    } else if (hasBankAccount || hasKhqrImage) {
      // Seller provided bank account or KHQR image — admin must manually enter in Bakong app
      // We generate a generic deeplink so admin can at least open Bakong quickly
      sellerPayoutMethod = hasKhqrImage ? 'khqr_image' : 'bank_account';
      // Use BothSafe's own account as placeholder (admin will change recipient manually)
      const fallbackAccount = this.cfg.get<string>('BAKONG_ACCOUNT_ID') ?? 'bothsafe@aba';
      deeplinkResult = await this.create(fallbackAccount, amount, currency, `BS-${deal.publicId}`);
    } else {
      // No payout info — generate an empty deeplink for admin to fill in
      sellerPayoutMethod = 'none';
      const fallbackAccount = this.cfg.get<string>('BAKONG_ACCOUNT_ID') ?? 'bothsafe@aba';
      deeplinkResult = await this.create(fallbackAccount, amount, currency, `BS-${deal.publicId}`);
    }

    return {
      ...deeplinkResult,
      seller_name: seller?.name ?? null,
      seller_payout_method: sellerPayoutMethod,
      seller_bank_name: seller?.payoutBankName ?? null,
      seller_account_name: seller?.payoutAccountName ?? null,
      seller_account_number: seller?.payoutAccountNumber ?? null,
      seller_khqr: seller?.payoutKhqr ?? null,
      seller_khqr_image: seller?.payoutKhqrImage ?? null,
      amount,
      currency,
      deal_public_id: deal.publicId,
    };
  }
}
