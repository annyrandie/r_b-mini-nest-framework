import 'reflect-metadata';
import { Controller } from '../decorators/controller';
import { Get, Post } from '../decorators/methods';
import { Body, Param, Query } from '../decorators/params';
import { createUserSchema, type CreateUserDto } from '../dto/create-user.dto';
import { NotFoundError } from '../errors/not-found.error';
import { UsersService, type User } from '../services/users.service';

@Controller('users')
export class UsersController {
  constructor(public readonly usersService: UsersService) {}

  @Get()
  list(@Query('limit') limit: string): { limit: string | undefined; users: User[] } {
    return { limit, users: this.usersService.list(limit) };
  }

  @Get(':id')
  getOne(@Param('id') id: string): { id: string; user: User } {
    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundError(`User "${id}" was not found`);
    }
    return { id, user };
  }

  @Post()
  create(@Body(createUserSchema) dto: CreateUserDto): User {
    return this.usersService.create(dto);
  }
}
