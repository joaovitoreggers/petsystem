import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserData, IUserRepository } from './user-repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  findByQrCode(qrCode: string): Promise<User | null> {
    return this.repository.findOneBy({ qrCode });
  }

  create(data: CreateUserData): Promise<User> {
    const user = this.repository.create({
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: data.role,
      accessLevel: data.accessLevel,
      qrCode: data.qrCode,
    });
    return this.repository.save(user);
  }
}
