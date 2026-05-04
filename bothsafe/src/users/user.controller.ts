import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  listUsers() {
    return this.users.listUsers();
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
