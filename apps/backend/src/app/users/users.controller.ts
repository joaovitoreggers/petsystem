import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

interface UserSummaryDto {
  id: string;
  name: string;
  email: string;
  role: string;
}

function toSummary(user: User): UserSummaryDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * CRUD de usuários (contas de login — porteiro/operador). O `password` nunca
 * sai daqui. Ver EmployeesController para o CRUD de funcionários de campo.
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

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserSummaryDto> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return toSummary(user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<UserSummaryDto> {
    const user = await this.usersService.create(dto);
    return toSummary(user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummaryDto> {
    const user = await this.usersService.update(id, dto);
    return toSummary(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (id === currentUser.id) {
      throw new ConflictException('Você não pode excluir seu próprio usuário');
    }
    await this.usersService.delete(id);
  }
}
