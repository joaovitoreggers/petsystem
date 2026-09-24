import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
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

const NOT_FOUND_MESSAGE = 'Funcionário não encontrado';
const PIN_SALT_ROUNDS = 10;

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
    return filterOwnedByScope(members, scope);
  }

  findByRegistration(registration: string): Promise<TeamMember | null> {
    return this.teamMemberRepository.findByRegistration(registration);
  }

  async create(data: CreateTeamMemberInput, scope?: TenantScope): Promise<TeamMember> {
    const existing = await this.teamMemberRepository.findByRegistration(data.registration);
    if (existing) {
      throw new ConflictException('Já existe um funcionário cadastrado com essa matrícula');
    }
    const companyGroupId = data.companyGroupId ?? scope?.companyGroupId ?? null;
    if (!companyGroupId) {
      throw new BadRequestException(
        'Não foi possível determinar o grupo de empresas deste cadastro',
      );
    }
    const branchId =
      data.branchId !== undefined ? data.branchId : await this.resolveBranchId(companyGroupId, data.unit);
    return this.teamMemberRepository.create({ ...data, companyGroupId, branchId });
  }

  async update(registration: string, data: UpdateTeamMemberInput, scope?: TenantScope): Promise<TeamMember> {
    const current = await this.teamMemberRepository.findByRegistration(registration);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const branchId =
      data.unit !== undefined
        ? await this.resolveBranchId(current.companyGroupId, data.unit)
        : undefined;
    const updated = await this.teamMemberRepository.update(registration, {
      ...data,
      ...(branchId !== undefined ? { branchId } : {}),
    });
    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  // Rota própria (não parte de update()): um técnico pode definir/resetar
  // o PIN de assinatura sem ter permissão para reescrever o resto do
  // cadastro (nome, empresa, cargo — isso continua exigindo admin/gestor).
  async setPin(registration: string, pin: string, scope?: TenantScope): Promise<void> {
    const current = await this.teamMemberRepository.findByRegistration(registration);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const pinHash = await bcrypt.hash(pin, PIN_SALT_ROUNDS);
    await this.teamMemberRepository.update(registration, { pinHash });
  }

  async delete(registration: string, scope?: TenantScope): Promise<void> {
    const current = await this.teamMemberRepository.findByRegistration(registration);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    await this.teamMemberRepository.delete(registration);
  }

  // Só para a migração do seed: preenche grupo/filial em funcionários que já
  // existiam antes da multi-tenancy, sem mexer em mais nada do cadastro.
  async backfillTenancy(
    registration: string,
    data: { companyGroupId: string | null; branchId: string | null },
  ): Promise<void> {
    await this.teamMemberRepository.update(registration, data);
  }

  // Tenta casar o texto livre `unit` com uma filial cadastrada no grupo
  // dono do registro — sem front-end de seleção de filial nesta fase, é a
  // melhor aproximação disponível. Sem match, fica sem filial mesmo (ainda
  // assim pertence ao grupo).
  private async resolveBranchId(companyGroupId: string | null, unit: string): Promise<string | null> {
    if (!companyGroupId) {
      return null;
    }
    const branch = await this.branchesService.findByCompanyGroupAndName(companyGroupId, unit);
    return branch?.id ?? null;
  }
}
