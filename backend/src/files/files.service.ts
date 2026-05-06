import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class FilesService {
  private readonly uploadsRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {
    this.uploadsRoot = resolve(process.cwd(), 'uploads');
    if (!existsSync(this.uploadsRoot)) mkdirSync(this.uploadsRoot, { recursive: true });
  }

  async store(file: Express.Multer.File, opts: {
    dealId?: string;
    category: string;
    isPublic?: boolean;
    uploadedBy?: string;
  }) {
    if (!file) throw new BadRequestException({ messageKey: 'file.required' });
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException({ messageKey: 'file.mime_not_allowed', details: { mime: file.mimetype } });
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException({ messageKey: 'file.too_large' });
    }
    if (file.originalname && /\.(exe|sh|bat|cmd|js|php)$/i.test(file.originalname)) {
      throw new BadRequestException({ messageKey: 'file.unsafe_extension' });
    }

    const id = randomBytes(16).toString('hex');
    const ext = file.mimetype === 'application/pdf' ? '.pdf' : '.bin';
    const safeExt =
      file.mimetype === 'image/jpeg' ? '.jpg' :
      file.mimetype === 'image/png' ? '.png' :
      file.mimetype === 'image/webp' ? '.webp' :
      file.mimetype === 'image/heic' ? '.heic' :
      ext;
    const key = `${opts.category}/${id}${safeExt}`;
    const fullPath = join(this.uploadsRoot, key);
    mkdirSync(join(this.uploadsRoot, opts.category), { recursive: true });
    writeFileSync(fullPath, file.buffer);

    const stored = await this.prisma.storedFile.create({
      data: {
        dealId: opts.dealId ?? null,
        category: opts.category,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: key,
        isPublic: opts.isPublic ?? false,
        uploadedBy: opts.uploadedBy ?? null,
      },
    });
    return stored;
  }

  // For MVP, "signed URL" = our own /v1/files/:id endpoint that re-checks access.
  signedUrlFor(file: { id: string; isPublic: boolean }): string {
    return `/v1/files/${file.id}`;
  }

  async findById(id: string) {
    return this.prisma.storedFile.findUnique({ where: { id } });
  }

  absolutePath(storageKey: string) {
    return join(this.uploadsRoot, storageKey);
  }
}
