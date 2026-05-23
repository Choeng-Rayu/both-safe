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
import { UserAuthService } from '../auth/user-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from '../common/utils/tokens';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly userAuth: UserAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary:
      'Stream a stored file. Public files open. Private files require ?access=, ?invite=, or an admin session cookie.',
  })
  async stream(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.files.findById(id);
    if (!file) throw new NotFoundException();

    if (!file.isPublic) {
      let allowed = false;
      const sessionToken: string | undefined = (
        req as Request & { cookies?: Record<string, string> }
      ).cookies?.[this.userAuth.cookieName];
      if (sessionToken) {
        const sessionUser = await this.userAuth.resolveSession(sessionToken);
        if (sessionUser?.role === 'ADMIN') {
          allowed = true;
        }
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
            else if (
              deal.participants.some((p) => p.accessTokenHash === tokenHash)
            )
              allowed = true;
          }
        }
      }
      if (!allowed)
        throw new ForbiddenException({ messageKey: 'auth.forbidden' });
    }

    const path = this.files.absolutePath(file.storageKey);
    if (!existsSync(path)) throw new NotFoundException();
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    createReadStream(path).pipe(res);
  }
}
