import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));

const envSchema = z.object({
  APP_URL: optionalUrl.default('http://localhost:3000'),
  API_URL: optionalUrl.default('http://localhost:3001'),
  ADMIN_URL: optionalUrl.default('http://localhost:3000/admin'),
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z
    .string()
    .min(1)
    .default(
      'postgresql://bothsafe:bothsafe@localhost:5432/bothsafe?schema=public',
    ),
  REDIS_URL: z.string().min(1).optional().or(z.literal('')),
  JWT_SECRET: z.string().min(16).optional().or(z.literal('')),
  SESSION_SECRET: z.string().min(16).optional().or(z.literal('')),
  ENCRYPTION_MASTER_KEY: z.string().optional().or(z.literal('')),
  TELEGRAM_BOT_TOKEN: z.string().optional().or(z.literal('')),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
  BINANCE_PAY_BASE_URL: optionalUrl.default('https://bpay.binanceapi.com'),
  BINANCE_PAY_API_KEY: z.string().optional().or(z.literal('')),
  BINANCE_PAY_SECRET_KEY: z.string().optional().or(z.literal('')),
  BINANCE_PAY_MERCHANT_ID: z.string().optional().or(z.literal('')),
  BINANCE_PAY_WEBHOOK_URL: optionalUrl.optional().or(z.literal('')),
  BINANCE_PAY_WEBHOOK_PUBLIC_KEY: z.string().optional().or(z.literal('')),
  BINANCE_PAY_CERTIFICATE_SN: z.string().optional().or(z.literal('')),
  PAYWAY_BASE_URL: optionalUrl.optional().or(z.literal('')),
  PAYWAY_MERCHANT_ID: z.string().optional().or(z.literal('')),
  PAYWAY_API_KEY: z.string().optional().or(z.literal('')),
  PAYWAY_PUBLIC_KEY: z.string().optional().or(z.literal('')),
  PAYWAY_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
  OBJECT_STORAGE_ENDPOINT: optionalUrl.optional().or(z.literal('')),
  OBJECT_STORAGE_REGION: z.string().default('auto'),
  OBJECT_STORAGE_BUCKET: z.string().optional().or(z.literal('')),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().optional().or(z.literal('')),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional().or(z.literal('')),
  CLAMAV_URL: optionalUrl.optional().or(z.literal('')),
  SENTRY_DSN: z.string().optional().or(z.literal('')),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl.optional().or(z.literal('')),
  AUTO_RELEASE_MODE: z.enum(['manual_approval']).default('manual_approval'),
  SUPPORTED_PAYMENT_RAILS: z.string().default('binance,payway_bakong,bakong'),
  BAKONG_MERCHANT_ID: z.string().optional().or(z.literal('')),
  BAKONG_PHONE_NUMBER: z.string().optional().or(z.literal('')),
  BAKONG_DEVELOPER_TOKEN: z.string().optional().or(z.literal('')),
  BAKONG_API_URL: optionalUrl.default('https://api-bakong.nbc.gov.kh/v1'),
  BAKONG_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}
