import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: this.config.get<string>('OBJECT_STORAGE_REGION') ?? 'auto',
      endpoint: this.config.get<string>('OBJECT_STORAGE_ENDPOINT') || undefined,
      credentials:
        this.config.get<string>('OBJECT_STORAGE_ACCESS_KEY_ID') &&
        this.config.get<string>('OBJECT_STORAGE_SECRET_ACCESS_KEY')
          ? {
              accessKeyId: this.config.get<string>(
                'OBJECT_STORAGE_ACCESS_KEY_ID',
              )!,
              secretAccessKey: this.config.get<string>(
                'OBJECT_STORAGE_SECRET_ACCESS_KEY',
              )!,
            }
          : undefined,
    });
  }

  createPrivateStorageKey(input: { productId: string; filename: string }) {
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `products/${input.productId}/${randomUUID()}-${safeFilename}`;
  }

  async createUploadUrl(input: {
    productId: string;
    filename: string;
    contentType: string;
  }) {
    const bucket = this.getBucket();
    const storageKey = this.createPrivateStorageKey(input);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 900,
    });

    return {
      storageKey,
      uploadUrl,
      expiresInSeconds: 900,
    };
  }

  async createDownloadUrl(storageKey: string) {
    const command = new GetObjectCommand({
      Bucket: this.getBucket(),
      Key: storageKey,
    });

    return {
      downloadUrl: await getSignedUrl(this.client, command, { expiresIn: 300 }),
      expiresInSeconds: 300,
    };
  }

  private getBucket() {
    const bucket = this.config.get<string>('OBJECT_STORAGE_BUCKET');

    if (!bucket) {
      throw new Error('OBJECT_STORAGE_BUCKET is required for object storage');
    }

    return bucket;
  }
}
