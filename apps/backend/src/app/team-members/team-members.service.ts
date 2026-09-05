import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { TeamMember } from './entities/team-member.entity';
import {
  CreateTeamMemberData,
  ITeamMemberRepository,
  TEAM_MEMBER_REPOSITORY,
} from './repositories/team-member-repository.interface';

export type CreateTeamMemberInput = CreateTeamMemberData;

/**
 * Público boundary de TeamMembersModule — controllers só dependem deste
 * service.
 */
@Injectable()
export class TeamMembersService {
  constructor(
    @Inject(TEAM_MEMBER_REPOSITORY)
    private readonly teamMemberRepository: ITeamMemberRepository,
  ) {}

  findAll(): Promise<TeamMember[]> {
    return this.teamMemberRepository.findAll();
  }

  findByRegistration(registration: string): Promise<TeamMember | null> {
    return this.teamMemberRepository.findByRegistration(registration);
  }

  async create(data: CreateTeamMemberInput): Promise<TeamMember> {
    const existing = await this.teamMemberRepository.findByRegistration(data.registration);
    if (existing) {
      throw new ConflictException('Já existe um funcionário cadastrado com essa matrícula');
    }
    return this.teamMemberRepository.create(data);
  }
}
