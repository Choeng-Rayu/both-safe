import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      name: 'bothsafe-api',
      status: 'ok',
      custodyModel: 'manual_release_first',
      releaseMode: process.env.AUTO_RELEASE_MODE ?? 'manual_approval',
    };
  }
}
