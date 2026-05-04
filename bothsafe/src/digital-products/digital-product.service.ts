import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertSafeDigitalProductDescription,
  validateUploadMetadata,
} from './digital-product-policy';
import { AddProductVersionDto, CreateProductDto } from './dto';

@Injectable()
export class DigitalProductService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(input: CreateProductDto) {
    try {
      assertSafeDigitalProductDescription(
        `${input.title} ${input.description ?? ''} ${input.category}`,
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    return this.prisma.digitalProduct.create({
      data: {
        sellerId: input.sellerId,
        title: input.title,
        description: input.description,
        type: input.type,
        priceMinor: BigInt(input.priceMinor),
        currency: input.currency.toUpperCase(),
        category: input.category,
        refundPolicy: input.refundPolicy,
      },
    });
  }

  listProducts() {
    return this.prisma.digitalProduct.findMany({
      where: { status: { not: ProductStatus.ARCHIVED } },
      include: { versions: true, plans: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  findProduct(id: string) {
    return this.prisma.digitalProduct.findUnique({
      where: { id },
      include: { versions: true, plans: true },
    });
  }

  async addVersion(productId: string, input: AddProductVersionDto) {
    try {
      validateUploadMetadata({
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const count = await this.prisma.productVersion.count({
      where: { productId },
    });

    return this.prisma.productVersion.create({
      data: {
        productId,
        version: count + 1,
        storageKey: input.storageKey,
        sha256: input.sha256,
        fileSize: BigInt(input.fileSize),
        mimeType: input.mimeType,
      },
    });
  }

  submitForReview(productId: string) {
    return this.prisma.digitalProduct.update({
      where: { id: productId },
      data: { status: ProductStatus.SUBMITTED },
    });
  }
}
