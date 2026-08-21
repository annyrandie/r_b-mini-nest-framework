import 'reflect-metadata';
import { Controller } from '../decorators/controller';
import { Get, Post } from '../decorators/methods';
import { Body, Param, Query } from '../decorators/params';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersService, type User } from '../services/users.service';

@Controller('users')
export class UsersController {
  constructor(public readonly usersService: UsersService) {}

  @Get()
  list(@Query('limit') limit: string): { limit: string | undefined; users: User[] } {
    return { limit, users: this.usersService.list(limit) };
  }

  @Get(':id')
  getOne(@Param('id') id: string): { id: string; user: User | null } {
    return { id, user: this.usersService.findById(id) ?? null };
  }

  @Post()
  create(@Body() dto: CreateUserDto): User {
    return this.usersService.create(dto);
  }
}
