import { Inject, Injectable } from '@nestjs/common';
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
  accessLevel: number;
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
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.userRepository.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      accessLevel: data.accessLevel,
    });
  }

  validatePassword(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, passwordHash);
  }
}
