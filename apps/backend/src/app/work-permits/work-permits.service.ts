import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '../auth/tenant-scope';
import { BranchesService } from '../tenancy/branches.service';
import { WorkPermit, WorkPermitGasReading } from './entities/work-permit.entity';
import {
  CreateWorkPermitData,
  IWorkPermitRepository,
  WORK_PERMIT_REPOSITORY,
} from './repositories/work-permit-repository.interface';

export type CreateWorkPermitInput = CreateWorkPermitData;

export interface CloseWorkPermitInput {
  end: string;
  durationMinutes: number;
}

export interface AddReadingInput {
  gas: WorkPermitGasReading;
}

/**
 * Público boundary de WorkPermitsModule — controllers e outros módulos só
 * dependem deste service.
 */
@Injectable()
export class WorkPermitsService {
  constructor(
    @Inject(WORK_PERMIT_REPOSITORY)
    private readonly workPermitRepository: IWorkPermitRepository,
    private readonly branchesService: BranchesService,
  ) {}

  async findAll(scope?: TenantScope): Promise<WorkPermit[]> {
    const permits = await this.workPermitRepository.findAll();
    return this.filterByScope(permits, scope);
  }

  findById(id: string): Promise<WorkPermit | null> {
    return this.workPermitRepository.findById(id);
  }

  async create(data: CreateWorkPermitInput, scope?: TenantScope): Promise<WorkPermit> {
    const branchId =
      data.branchId !== undefined ? data.branchId : await this.resolveBranchId(data.unit, scope);
    return this.workPermitRepository.create({ ...data, branchId });
  }

  async close(id: string, data: CloseWorkPermitInput): Promise<WorkPermit> {
    const closed = await this.workPermitRepository.close(id, data);
    if (!closed) {
      throw new NotFoundException('PET não encontrada');
    }
    return closed;
  }

  async addReading(id: string, data: AddReadingInput): Promise<WorkPermit> {
    const updated = await this.workPermitRepository.addReading(id, data);
    if (!updated) {
      throw new NotFoundException('PET não encontrada');
    }
    return updated;
  }

  // Só para a migração do seed: preenche branchId em PETs que já existiam
  // antes da multi-tenancy, sem mexer em mais nada do registro.
  async backfillBranch(id: string, branchId: string | null): Promise<void> {
    await this.workPermitRepository.updateBranch(id, branchId);
  }

  // Mesma lógica de resolução por nome usada em TeamMembersService — sem
  // front-end de seleção de filial nesta fase, tenta casar `unit` (texto
  // livre) com uma filial do grupo de quem está emitindo a PET.
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

  private async filterByScope(permits: WorkPermit[], scope?: TenantScope): Promise<WorkPermit[]> {
    if (!scope || scope.role === 'platform-admin') {
      return permits;
    }
    if (scope.branchId) {
      return permits.filter((p) => p.branchId === scope.branchId);
    }
    if (!scope.companyGroupId) {
      return permits;
    }
    const branches = await this.branchesService.findByCompanyGroup(scope.companyGroupId);
    const branchIds = new Set(branches.map((b) => b.id));
    return permits.filter((p) => p.branchId != null && branchIds.has(p.branchId));
  }
}

export type { WorkPermitGasReading };
