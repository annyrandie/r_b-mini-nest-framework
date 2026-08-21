import 'reflect-metadata';
import { Injectable } from '../decorators/injectable';
import type { CreateUserDto } from '../dto/create-user.dto';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  private readonly users: User[] = [];
  private nextId = 1;

  create(dto: CreateUserDto): User {
    const user: User = { id: this.nextId++, name: dto.name, email: dto.email };
    this.users.push(user);
    return user;
  }

  findById(id: string): User | undefined {
    return this.users.find(user => user.id === Number(id));
  }

  list(limit?: string): User[] {
    const max = limit === undefined ? this.users.length : Number(limit);
    return this.users.slice(0, max);
  }
}
