import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * BotWebhookGuard — validates incoming Telegram webhook requests.
 * Checks X-Telegram-Bot-Api-Secret-Token header and (optionally) Telegram IP ranges.
 */
@Injectable()
export class BotWebhookGuard implements CanActivate {
  private readonly logger = new Logger(BotWebhookGuard.name);
  private readonly secretToken: string;
  private readonly telegramIpRanges: string[];

  constructor(private readonly cfg: ConfigService) {
    this.secretToken = this.cfg.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
    // Telegram IP ranges (AWS AS16509) — expand as needed
    this.telegramIpRanges = [
      '149.154.160.0/20',
      '91.108.4.0/22',
    ];
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // 1. Validate secret token if configured
    if (this.secretToken) {
      const headerToken = req.headers['x-telegram-bot-api-secret-token'];
      if (headerToken !== this.secretToken) {
        this.logger.warn(`Invalid webhook secret token from ${req.ip}`);
        throw new ForbiddenException('Invalid webhook secret');
      }
    }

    // 2. Optional: validate source IP is in Telegram ranges
    // Note: In production behind a proxy, use x-forwarded-for
    // This is a basic check; for stricter security, use a reverse proxy or AWS WAF
    // const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '';
    // if (!this.isIpInRanges(clientIp, this.telegramIpRanges)) {
    //   this.logger.warn(`Webhook request from non-Telegram IP: ${clientIp}`);
    //   throw new ForbiddenException('Invalid source IP');
    // }

    return true;
  }

  private isIpInRanges(ip: string, ranges: string[]): boolean {
    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      // Allow localhost for development
      return true;
    }
    // Basic CIDR check — simplified for MVP
    // In production, use a library like 'ip-range-check'
    return true; // disabled for MVP — enable with proper CIDR library
  }
}
