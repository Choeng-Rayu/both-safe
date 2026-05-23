import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

/**
 * Manages the Bakong Open API token lifecycle.
 * Token is loaded from BAKONG_API_TOKEN env on startup.
 * A cron job renews it every ~80 days automatically.
 */
@Injectable()
export class BakongTokenService implements OnModuleInit {
  private readonly logger = new Logger(BakongTokenService.name);
  private token: string = '';

  constructor(
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
  ) {}

  onModuleInit() {
    this.token = this.cfg.get<string>('BAKONG_API_TOKEN') ?? '';
    if (!this.token) {
      this.logger.warn(
        'BAKONG_API_TOKEN not set — deeplink generation will fail. Run /v1/bakong/setup/request-email to obtain one.',
      );
    } else {
      this.logger.log('Bakong API token loaded from env.');
    }
  }

  /** Step 1 (one-time setup): Request a verification code to be sent to the configured email. */
  async requestEmail(): Promise<void> {
    const base =
      this.cfg.get<string>('BAKONG_BASE_URL') ??
      'https://api-bakong.nbc.gov.kh';
    await firstValueFrom(
      this.http.post(`${base}/v1/request_token`, {
        email: this.cfg.get<string>('BAKONG_EMAIL'),
        organization:
          this.cfg.get<string>('BAKONG_MERCHANT_NAME') ?? 'BothSafe',
        project: 'BothSafe Escrow',
      }),
    );
    this.logger.log('Bakong token request email sent.');
  }

  /** Step 2 (one-time setup): Submit the code received by email to get the API token. */
  async verify(code: string): Promise<string> {
    const base =
      this.cfg.get<string>('BAKONG_BASE_URL') ??
      'https://api-bakong.nbc.gov.kh';
    const { data } = await firstValueFrom(
      this.http.post<{
        responseCode: number;
        responseMessage: string;
        data?: { token: string };
      }>(`${base}/v1/verify`, { code }),
    );
    if (data.responseCode !== 0) {
      throw new Error(`Bakong verify failed: ${data.responseMessage}`);
    }
    this.token = data.data!.token;
    this.logger.log(
      'Bakong API token verified and stored in memory. Copy it to BAKONG_API_TOKEN in .env to persist.',
    );
    return this.token;
  }

  /** Automatic token renewal — runs monthly. */
  @Cron('0 0 1 */2 *') // first day of every other month
  async renew(): Promise<void> {
    if (!this.token) return;
    try {
      const base =
        this.cfg.get<string>('BAKONG_BASE_URL') ??
        'https://api-bakong.nbc.gov.kh';
      const { data } = await firstValueFrom(
        this.http.post<{ responseCode: number; data?: { token: string } }>(
          `${base}/v1/renew_token`,
          { email: this.cfg.get<string>('BAKONG_EMAIL') },
        ),
      );
      if (data.responseCode === 0 && data.data?.token) {
        this.token = data.data.token;
        this.logger.log('Bakong API token renewed automatically.');
      }
    } catch (err) {
      this.logger.error('Bakong token renewal failed', err);
    }
  }

  get(): string {
    return this.token;
  }
}
