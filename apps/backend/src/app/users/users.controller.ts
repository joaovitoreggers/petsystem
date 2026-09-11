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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
 * CRUD de usuários (contas de login). O `password` nunca sai daqui. Ver
 * EmployeesController para o CRUD de funcionários de campo (Employee) e
 * TeamMembersController para o cadastro do SESMT (TeamMember) — nenhum dos
 * três é a mesma entidade.
 *
 * Criar/editar/excluir usuário decide quem tem acesso ao sistema e com que
 * papel — por isso, além de exigir login (`JwtAuthGuard`, no controller
 * inteiro), essas três rotas também exigem papel admin/gestor
 * (`RolesGuard`), senão qualquer conta autenticada (até uma `tecnico`)
 * poderia se promover ou criar outra conta com mais privilégio.
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
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<UserSummaryDto> {
    const user = await this.usersService.create(dto);
    return toSummary(user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummaryDto> {
    const user = await this.usersService.update(id, dto);
    return toSummary(user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
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
