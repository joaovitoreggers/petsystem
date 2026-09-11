import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from './entities/branch.entity';
import {
  BRANCH_REPOSITORY,
  IBranchRepository,
} from './repositories/branch-repository.interface';
import { TenancyReferenceGuardService } from './tenancy-reference-guard.service';

export interface CreateBranchInput {
  companyGroupId: string;
  name: string;
}

export interface UpdateBranchInput {
  name?: string;
}

/**
 * Público boundary de filiais — controllers e outros módulos (TeamMembers,
 * WorkPermits, Users) só dependem deste service para resolver/filtrar por
 * filial, nunca do repositório diretamente.
 */
@Injectable()
export class BranchesService {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: IBranchRepository,
    private readonly referenceGuard: TenancyReferenceGuardService,
  ) {}

  findAll(): Promise<Branch[]> {
    return this.branchRepository.findAll();
  }

  findById(id: string): Promise<Branch | null> {
    return this.branchRepository.findById(id);
  }

  async getByIdOrFail(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findById(id);
    if (!branch) {
      throw new NotFoundException('Filial não encontrada');
    }
    return branch;
  }

  findByCompanyGroup(companyGroupId: string): Promise<Branch[]> {
    return this.branchRepository.findByCompanyGroup(companyGroupId);
  }

  // Usado no cadastro de PETs/funcionários (que ainda só coletam o texto
  // livre `unit`) para tentar encontrar a filial relacional correspondente,
  // sem exigir nenhuma mudança no front-end nesta fase.
  async findByCompanyGroupAndName(
    companyGroupId: string,
    name: string,
  ): Promise<Branch | null> {
    const branches = await this.branchRepository.findByCompanyGroup(companyGroupId);
    const normalized = name.trim().toLowerCase();
    return (
      branches.find((branch) => branch.name.trim().toLowerCase() === normalized) ?? null
    );
  }

  create(data: CreateBranchInput): Promise<Branch> {
    return this.branchRepository.create(data);
  }

  async update(id: string, data: UpdateBranchInput): Promise<Branch> {
    const updated = await this.branchRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException('Filial não encontrada');
    }
    return updated;
  }

  // Bloqueia em vez de deixar órfão: uma filial com usuários, PETs ou
  // funcionários ainda vinculados não pode sumir de baixo deles.
  async delete(id: string): Promise<void> {
    await this.getByIdOrFail(id);
    const hasReferences = await this.referenceGuard.branchHasReferences(id);
    if (hasReferences) {
      throw new ConflictException(
        'Não é possível excluir: ainda há usuários, PETs ou funcionários vinculados a esta filial',
      );
    }
    await this.branchRepository.delete(id);
  }
}
