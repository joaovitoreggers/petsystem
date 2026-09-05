import { User } from '../entities/user.entity';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  accessLevel: number;
  qrCode: string;
}

/**
 * Repository pattern: isolates data access for User from the ORM choice.
 * Only UsersModule may depend on this token; other modules go through UsersService.
 */
export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByQrCode(qrCode: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
