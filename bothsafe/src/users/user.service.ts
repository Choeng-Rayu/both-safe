import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  upsertTelegramUser(input: {
    telegramId: string;
    displayName?: string;
    country?: string;
  }) {
    return this.prisma.user.upsert({
      where: { telegramId: input.telegramId },
      create: {
        telegramId: input.telegramId,
        displayName: input.displayName,
        country: input.country,
      },
      update: {
        displayName: input.displayName,
        country: input.country,
      },
    });
  }
}
