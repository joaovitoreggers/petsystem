import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember } from '../entities/team-member.entity';
import { CreateTeamMemberData, ITeamMemberRepository } from './team-member-repository.interface';

@Injectable()
export class TeamMemberRepository implements ITeamMemberRepository {
  constructor(
    @InjectRepository(TeamMember)
    private readonly repository: Repository<TeamMember>,
  ) {}

  findAll(): Promise<TeamMember[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findByRegistration(registration: string): Promise<TeamMember | null> {
    return this.repository.findOneBy({ registration });
  }

  create(data: CreateTeamMemberData): Promise<TeamMember> {
    const member = this.repository.create({
      registration: data.registration,
      name: data.name,
      role: data.role,
      company: data.company,
      unit: data.unit,
      isThirdParty: data.isThirdParty ?? false,
      documents: data.documents,
    });
    return this.repository.save(member);
  }
}
