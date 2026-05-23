import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BakongTokenService } from './bakong-token.service';

export interface TransactionStatus {
  paid: boolean;
  hash?: string;
  fromAccountId?: string;
  toAccountId?: string;
  currency?: string;
  amount?: number;
  description?: string;
  createdDateMs?: number;
  acknowledgedDateMs?: number;
}

/**
 * Polls the Bakong Open API to verify whether a transaction (identified by MD5) has been paid.
 * Used by admin to confirm that a payment was actually received or sent.
 */
@Injectable()
export class BakongPollService {
  private readonly logger = new Logger(BakongPollService.name);

  constructor(
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
    private readonly token: BakongTokenService,
  ) {}

  async check(md5: string): Promise<TransactionStatus> {
    const base =
      this.cfg.get<string>('BAKONG_BASE_URL') ??
      'https://api-bakong.nbc.gov.kh';
    const tkn = this.token.get();

    if (!tkn) {
      this.logger.warn(
        'Bakong token not configured — cannot check transaction',
      );
      return { paid: false };
    }

    try {
      const { data } = await firstValueFrom(
        this.http.post<{
          responseCode: number;
          data?: Record<string, unknown>;
        }>(
          `${base}/v1/check_transaction_by_md5`,
          { md5 },
          {
            headers: {
              Authorization: `Bearer ${tkn}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (data.responseCode === 0 && data.data) {
        return {
          paid: true,
          hash: data.data['hash'] as string | undefined,
          fromAccountId: data.data['fromAccountId'] as string | undefined,
          toAccountId: data.data['toAccountId'] as string | undefined,
          currency: data.data['currency'] as string | undefined,
          amount: data.data['amount'] as number | undefined,
          description: data.data['description'] as string | undefined,
          createdDateMs: data.data['createdDateMs'] as number | undefined,
          acknowledgedDateMs: data.data['acknowledgedDateMs'] as
            | number
            | undefined,
        };
      }
      return { paid: false };
    } catch (err) {
      this.logger.error('Bakong poll check failed', err);
      return { paid: false };
    }
  }
}
