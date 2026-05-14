import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) should return 200', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });

  afterAll(async () => {
    try {
      await app.close();
    } catch {
      // Bot may throw on shutdown — ignore
    }
  });
});
