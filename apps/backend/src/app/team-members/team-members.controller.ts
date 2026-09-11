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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamMember } from './entities/team-member.entity';
import { TeamMembersService } from './team-members.service';

/**
 * Cadastro de funcionários (registro de trabalhadores autorizados do SESMT).
 * Leitura e criação seguem sem @UseGuards de propósito — são o caminho
 * usado também pela simulação de reconhecimento facial, que não gera token.
 * Edição e exclusão mexem em dado crítico (NRs, vínculo) e por isso exigem
 * login de verdade (e-mail/senha) com papel de admin ou gestor.
 */
@Controller('team-members')
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Get()
  findAll(): Promise<TeamMember[]> {
    return this.teamMembersService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTeamMemberDto): Promise<TeamMember> {
    return this.teamMembersService.create(dto);
  }

  @Patch(':registration')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'gestor')
  update(
    @Param('registration') registration: string,
    @Body() dto: UpdateTeamMemberDto,
  ): Promise<TeamMember> {
    return this.teamMembersService.update(registration, dto);
  }

  @Delete(':registration')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'gestor')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('registration') registration: string): Promise<void> {
    return this.teamMembersService.delete(registration);
  }
}
