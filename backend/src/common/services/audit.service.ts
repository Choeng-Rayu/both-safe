import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditInput {
  dealId?: string | null;
  actorType: 'participant' | 'admin' | 'system';
  actorId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        dealId: input.dealId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        details: input.details ? JSON.stringify(input.details) : null,
      },
    });
  }
}
