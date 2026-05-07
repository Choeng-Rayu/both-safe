import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { DealsModule } from '../deals/deals.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DealsModule, AuthModule],
  controllers: [UsersController],
})
export class UsersModule {}
