import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  CreateUserData,
  IUserRepository,
  UpdateUserData,
} from './user-repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  create(data: CreateUserData): Promise<User> {
    const user = this.repository.create({
      id: randomUUID(),
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: data.role,
    });
    return this.repository.save(user);
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const user = await this.repository.findOneBy({ id });
    if (!user) {
      return null;
    }
    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    if (data.passwordHash !== undefined) user.password = data.passwordHash;
    if (data.role !== undefined) user.role = data.role;
    return this.repository.save(user);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
