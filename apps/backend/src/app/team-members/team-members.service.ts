import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '../auth/tenant-scope';
import { BranchesService } from '../tenancy/branches.service';
import { TeamMember } from './entities/team-member.entity';
import {
  CreateTeamMemberData,
  ITeamMemberRepository,
  TEAM_MEMBER_REPOSITORY,
  UpdateTeamMemberData,
} from './repositories/team-member-repository.interface';

export type CreateTeamMemberInput = CreateTeamMemberData;
export type UpdateTeamMemberInput = UpdateTeamMemberData;

/**
 * Público boundary de TeamMembersModule — controllers só dependem deste
 * service.
 */
@Injectable()
export class TeamMembersService {
  constructor(
    @Inject(TEAM_MEMBER_REPOSITORY)
    private readonly teamMemberRepository: ITeamMemberRepository,
    private readonly branchesService: BranchesService,
  ) {}

  async findAll(scope?: TenantScope): Promise<TeamMember[]> {
    const members = await this.teamMemberRepository.findAll();
    return this.filterByScope(members, scope);
  }

  findByRegistration(registration: string): Promise<TeamMember | null> {
    return this.teamMemberRepository.findByRegistration(registration);
  }

  async create(data: CreateTeamMemberInput, scope?: TenantScope): Promise<TeamMember> {
    const existing = await this.teamMemberRepository.findByRegistration(data.registration);
    if (existing) {
      throw new ConflictException('Já existe um funcionário cadastrado com essa matrícula');
    }
    const branchId =
      data.branchId !== undefined ? data.branchId : await this.resolveBranchId(data.unit, scope);
    return this.teamMemberRepository.create({ ...data, branchId });
  }

  async update(registration: string, data: UpdateTeamMemberInput, scope?: TenantScope): Promise<TeamMember> {
    const branchId =
      data.unit !== undefined ? await this.resolveBranchId(data.unit, scope) : undefined;
    const updated = await this.teamMemberRepository.update(registration, {
      ...data,
      ...(branchId !== undefined ? { branchId } : {}),
    });
    if (!updated) {
      throw new NotFoundException('Funcionário não encontrado');
    }
    return updated;
  }

  async delete(registration: string): Promise<void> {
    const removed = await this.teamMemberRepository.delete(registration);
    if (!removed) {
      throw new NotFoundException('Funcionário não encontrado');
    }
  }

  // Só para a migração do seed: preenche branchId em funcionários que já
  // existiam antes da multi-tenancy, sem mexer em mais nada do cadastro.
  async backfillBranch(registration: string, branchId: string | null): Promise<void> {
    await this.teamMemberRepository.update(registration, { branchId });
  }

  // Tenta casar o texto livre `unit` com uma filial cadastrada no grupo de
  // quem está cadastrando — sem front-end de seleção de filial nesta fase,
  // é a melhor aproximação disponível. Sem match (ou sem sessão com grupo,
  // ex. o caminho de reconhecimento facial), fica sem filial mesmo.
  private async resolveBranchId(unit: string, scope?: TenantScope): Promise<string | null> {
    if (!scope?.companyGroupId) {
      return null;
    }
    const branch = await this.branchesService.findByCompanyGroupAndName(
      scope.companyGroupId,
      unit,
    );
    return branch?.id ?? null;
  }

  private async filterByScope(members: TeamMember[], scope?: TenantScope): Promise<TeamMember[]> {
    if (!scope || scope.role === 'platform-admin') {
      return members;
    }
    if (scope.branchId) {
      return members.filter((m) => m.branchId === scope.branchId);
    }
    if (!scope.companyGroupId) {
      return members;
    }
    const branches = await this.branchesService.findByCompanyGroup(scope.companyGroupId);
    const branchIds = new Set(branches.map((b) => b.id));
    return members.filter((m) => m.branchId != null && branchIds.has(m.branchId));
  }
}
