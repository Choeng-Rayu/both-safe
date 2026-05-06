import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { FilesService } from './files.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from '../common/utils/tokens';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary:
      'Stream a stored file. Public files open. Private files require ?access=, ?invite=, or admin Bearer token bound to the file\'s deal.',
  })
  async stream(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const file = await this.files.findById(id);
    if (!file) throw new NotFoundException();

    if (!file.isPublic) {
      let allowed = false;
      const header = req.headers['authorization'] as string | undefined;
      if (header?.startsWith('Bearer ')) {
        try {
          await this.auth.verifyAdminJwt(header.slice(7));
          allowed = true;
        } catch {}
      }
      if (!allowed && file.dealId) {
        const access = (req.query.access as string) || '';
        const invite = (req.query.invite as string) || '';
        if (access || invite) {
          const tokenHash = hashToken(access || invite);
          const deal = await this.prisma.deal.findUnique({
            where: { id: file.dealId },
            include: { participants: true },
          });
          if (deal) {
            if (deal.creatorAccessTokenHash === tokenHash) allowed = true;
            else if (deal.inviteTokenHash === tokenHash) allowed = true;
            else if (deal.participants.some((p) => p.accessTokenHash === tokenHash)) allowed = true;
          }
        }
      }
      if (!allowed) throw new ForbiddenException({ messageKey: 'auth.forbidden' });
    }

    const path = this.files.absolutePath(file.storageKey);
    if (!existsSync(path)) throw new NotFoundException();
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    createReadStream(path).pipe(res);
  }
}
