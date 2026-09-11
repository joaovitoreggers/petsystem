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
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamMember } from './entities/team-member.entity';
import { TeamMembersService } from './team-members.service';

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
  findAll(@CurrentUser() currentUser: AuthenticatedUser): Promise<TeamMember[]> {
    return this.teamMembersService.findAll(scopeFromUser(currentUser));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTeamMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TeamMember> {
    return this.teamMembersService.create(dto, scopeFromUser(currentUser));
  }

  @Patch(':registration')
  @UseGuards(RolesGuard)
  @Roles('admin', 'gestor')
  update(
    @Param('registration') registration: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TeamMember> {
    return this.teamMembersService.update(registration, dto, scopeFromUser(currentUser));
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
