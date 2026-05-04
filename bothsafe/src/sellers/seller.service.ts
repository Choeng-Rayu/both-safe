import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellerService {
  constructor(private readonly prisma: PrismaService) {}

  createSeller(input: {
    userId: string;
    businessName?: string;
    country?: string;
    payoutProvider?: string;
    payoutIdentifier?: string;
  }) {
    return this.prisma.seller.create({ data: input });
  }

  listSellers() {
    return this.prisma.seller.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
