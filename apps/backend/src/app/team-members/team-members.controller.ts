import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { SetTeamMemberPinDto } from './dto/set-team-member-pin.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamMember } from './entities/team-member.entity';
import { TeamMembersService } from './team-members.service';

type PublicTeamMember = Omit<TeamMember, 'pinHash'>;

// `pinHash` nunca deve sair do backend — mesmo padrão de toSummary() em
// UsersController, que esconde `password`.
function toPublic(member: TeamMember): PublicTeamMember {
  const { pinHash: _pinHash, ...rest } = member;
  return rest;
}

/**
 * Cadastro de funcionários (registro de trabalhadores autorizados do SESMT).
 * Toda a rota exige login de verdade (JwtAuthGuard) — sem sessão não dá pra
 * saber a qual tenant o registro pertence. O caminho de reconhecimento
 * facial (sem token) cai no fallback local do front-end nesse caso.
 * Edição e exclusão mexem em dado crítico (NRs, vínculo) e por isso exigem
 * papel de admin ou gestor, além do login.
 */
@Controller('team-members')
@UseGuards(JwtAuthGuard)
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Get()
  async findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<PublicTeamMember[]> {
    const members = await this.teamMembersService.findAll(scopeFromUser(currentUser));
    return members.map(toPublic);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTeamMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublicTeamMember> {
    const member = await this.teamMembersService.create(dto, scopeFromUser(currentUser));
    return toPublic(member);
  }

  @Patch(':registration')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  async update(
    @Param('registration') registration: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PublicTeamMember> {
    const member = await this.teamMembersService.update(registration, dto, scopeFromUser(currentUser));
    return toPublic(member);
  }

  // Rota própria, separada de update(): um técnico pode definir/resetar o
  // PIN de assinatura de um funcionário sem precisar de alçada para
  // reescrever o resto do cadastro (nome, empresa, cargo).
  @Patch(':registration/pin')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor', 'tecnico')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPin(
    @Param('registration') registration: string,
    @Body() dto: SetTeamMemberPinDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.teamMembersService.setPin(registration, dto.pin, scopeFromUser(currentUser));
  }

  @Delete(':registration')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('registration') registration: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.teamMembersService.delete(registration, scopeFromUser(currentUser));
  }
}
