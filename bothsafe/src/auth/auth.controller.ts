import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { UserService } from '../users/user.service';

class TelegramLoginDto {
  @IsString()
  telegramId!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly users: UserService) {}

  @Get('status')
  status() {
    return {
      auth: 'scaffold',
      productionRequirement: 'replace with signed sessions and admin MFA',
    };
  }

  @Post('telegram')
  telegramLogin(@Body() body: TelegramLoginDto) {
    return this.users.upsertTelegramUser(body);
  }
}
