import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember } from '../entities/team-member.entity';
import {
  CreateTeamMemberData,
  ITeamMemberRepository,
  UpdateTeamMemberData,
} from './team-member-repository.interface';

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
      companyGroupId: data.companyGroupId ?? null,
      branchId: data.branchId ?? null,
      isThirdParty: data.isThirdParty ?? false,
      documents: data.documents,
      phone: data.phone ?? null,
    });
    return this.repository.save(member);
  }

  async update(registration: string, data: UpdateTeamMemberData): Promise<TeamMember | null> {
    const member = await this.repository.findOneBy({ registration });
    if (!member) {
      return null;
    }
    if (data.name !== undefined) member.name = data.name;
    if (data.role !== undefined) member.role = data.role;
    if (data.company !== undefined) member.company = data.company;
    if (data.unit !== undefined) member.unit = data.unit;
    if (data.companyGroupId !== undefined) member.companyGroupId = data.companyGroupId;
    if (data.branchId !== undefined) member.branchId = data.branchId;
    if (data.isThirdParty !== undefined) member.isThirdParty = data.isThirdParty;
    if (data.documents !== undefined) member.documents = data.documents;
    if (data.phone !== undefined) member.phone = data.phone;
    if (data.pinHash !== undefined) member.pinHash = data.pinHash;
    return this.repository.save(member);
  }

  async delete(registration: string): Promise<boolean> {
    const result = await this.repository.delete({ registration });
    return (result.affected ?? 0) > 0;
  }
}
