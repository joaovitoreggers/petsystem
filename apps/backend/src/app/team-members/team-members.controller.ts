import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { TeamMember } from './entities/team-member.entity';
import { TeamMembersService } from './team-members.service';

/**
 * Cadastro de funcionários (registro de trabalhadores autorizados do SESMT).
 * Sem @UseGuards(JwtAuthGuard) de propósito: o front-end do PET Digital não
 * tem mais uma tela de login real neste MVP — ver o mesmo comentário em
 * WorkPermitsController.
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
}
