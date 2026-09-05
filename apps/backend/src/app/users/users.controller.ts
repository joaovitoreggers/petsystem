import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

interface UserSummaryDto {
  id: number;
  name: string;
  email: string;
  role: string;
  accessLevel: number;
  qrCode: string;
}

function toSummary(user: User): UserSummaryDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accessLevel: user.accessLevel,
    qrCode: user.qrCode,
  };
}

/**
 * Lista de usuários para a tela de crachás temporários (apps/frontend/src/app/badges):
 * o password nunca sai daqui.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<UserSummaryDto[]> {
    const users = await this.usersService.findAll();
    return users.map(toSummary);
  }
}
