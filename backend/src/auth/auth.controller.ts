import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

class AdminLoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('admin/login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Admin login (returns JWT)' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.loginAdmin(dto.email, dto.password);
  }
}
