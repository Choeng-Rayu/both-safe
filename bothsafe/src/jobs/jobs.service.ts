import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const QUEUES = {
  autoRelease: 'bothsafe.auto-release',
  paymentReconciliation: 'bothsafe.payment-reconciliation',
  notifications: 'bothsafe.notifications',
} as const;

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private connection?: IORedis;
  private queues = new Map<string, Queue>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.log('BullMQ disabled because REDIS_URL is not set');
      return;
    }

    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.connection = connection;
    Object.values(QUEUES).forEach((name) => {
      this.queues.set(name, new Queue(name, { connection }));
    });
    this.logger.log(`BullMQ queues ready: ${Object.values(QUEUES).join(', ')}`);
  }

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.queues.values()).map((queue) => queue.close()),
    );
    await this.connection?.quit();
  }

  async enqueueAutoReleaseScan() {
    return this.enqueue(QUEUES.autoRelease, 'scan-release-candidates', {});
  }

  async enqueuePaymentReconciliation(provider: string) {
    return this.enqueue(QUEUES.paymentReconciliation, 'reconcile-provider', {
      provider,
    });
  }

  private async enqueue(
    queueName: string,
    jobName: string,
    payload: Record<string, unknown>,
  ) {
    const queue = this.queues.get(queueName);

    if (!queue) {
      return { queued: false, reason: 'queue_disabled' };
    }

    const job = await queue.add(jobName, payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    return { queued: true, jobId: job.id };
  }
}
