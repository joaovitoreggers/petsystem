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
import { scopeFromUser } from '../auth/tenant-scope';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

interface UserSummaryDto {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  companyGroupId: string | null;
  branchId: string | null;
}

function toSummary(user: User): UserSummaryDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    companyGroupId: user.companyGroupId,
    branchId: user.branchId,
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<UserSummaryDto[]> {
    const users = await this.usersService.findAll(scopeFromUser(currentUser));
    return users.map(toSummary);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserSummaryDto> {
    const user = await this.usersService.findById(id, scopeFromUser(currentUser));
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return toSummary(user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserSummaryDto> {
    const user = await this.usersService.create(dto, scopeFromUser(currentUser));
    return toSummary(user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserSummaryDto> {
    const user = await this.usersService.update(id, dto, scopeFromUser(currentUser));
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
    await this.usersService.delete(id, scopeFromUser(currentUser));
  }
}
