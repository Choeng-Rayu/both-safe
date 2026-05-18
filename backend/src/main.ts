import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as dns from 'dns';
import { AppModule } from './app.module';
import { WinstonLoggerService } from './common/logger/winston-logger.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser: (options?: import('cookie-parser').CookieParseOptions) => import('express').RequestHandler = require('cookie-parser');

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const winstonLogger = new WinstonLoggerService();
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
    bufferLogs: true,
  });
  const logger = new Logger('bootstrap');

  // Parse cookies for session auth
  app.use(cookieParser());

  app.setGlobalPrefix('v1', { exclude: ['/'] });

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — allow all in dev when CORS_ORIGINS is empty.
  const corsList = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: corsList.length ? corsList : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  });

  const config = new DocumentBuilder()
    .setTitle('BothSafe API')
    .setDescription('BothSafe Deal Room MVP backend (v1)')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('deals')
    .addTag('payments')
    .addTag('shipping')
    .addTag('disputes')
    .addTag('admin')
    .addTag('files')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`BothSafe backend listening on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}
bootstrap();
