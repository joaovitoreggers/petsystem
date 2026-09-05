import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import {
  IUserRepository,
  USER_REPOSITORY,
} from './repositories/user-repository.interface';

const SALT_ROUNDS = 10;

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

/**
 * Public boundary of UsersModule. Other modules (Auth, QrValidation) depend
 * only on this service, never on IUserRepository directly.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async create(data: CreateUserInput): Promise<User> {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Este email já está em uso');
    }
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.userRepository.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
    });
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    if (data.email !== undefined) {
      const existing = await this.userRepository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Este email já está em uso');
      }
    }

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, SALT_ROUNDS)
      : undefined;

    const updated = await this.userRepository.update(id, {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
    });

    if (!updated) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException('Usuário não encontrado');
    }
  }

  validatePassword(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, passwordHash);
  }
}
