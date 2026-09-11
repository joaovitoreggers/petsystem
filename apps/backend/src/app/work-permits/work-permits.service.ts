import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
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

const NOT_FOUND_MESSAGE = 'PET não encontrada';

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
    return filterOwnedByScope(permits, scope);
  }

  async findById(id: string, scope?: TenantScope): Promise<WorkPermit | null> {
    const permit = await this.workPermitRepository.findById(id);
    if (!permit) {
      return null;
    }
    assertOwnedByScope(permit, scope, NOT_FOUND_MESSAGE);
    return permit;
  }

  async create(data: CreateWorkPermitInput, scope?: TenantScope): Promise<WorkPermit> {
    const companyGroupId = data.companyGroupId ?? scope?.companyGroupId ?? null;
    if (!companyGroupId) {
      throw new BadRequestException(
        'Não foi possível determinar o grupo de empresas desta PET',
      );
    }
    const branchId =
      data.branchId !== undefined ? data.branchId : await this.resolveBranchId(companyGroupId, data.unit);
    return this.workPermitRepository.create({ ...data, companyGroupId, branchId });
  }

  async close(id: string, data: CloseWorkPermitInput, scope?: TenantScope): Promise<WorkPermit> {
    const current = await this.workPermitRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const closed = await this.workPermitRepository.close(id, data);
    if (!closed) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return closed;
  }

  async addReading(id: string, data: AddReadingInput, scope?: TenantScope): Promise<WorkPermit> {
    const current = await this.workPermitRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const updated = await this.workPermitRepository.addReading(id, data);
    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  // Só para a migração do seed: preenche grupo/filial em PETs que já
  // existiam antes da multi-tenancy, sem mexer em mais nada do registro.
  async backfillTenancy(
    id: string,
    data: { companyGroupId: string | null; branchId: string | null },
  ): Promise<void> {
    await this.workPermitRepository.updateTenancy(id, data);
  }

  // Mesma lógica de resolução por nome usada em TeamMembersService — sem
  // front-end de seleção de filial nesta fase, tenta casar `unit` (texto
  // livre) com uma filial do grupo dono da PET.
  private async resolveBranchId(companyGroupId: string | null, unit: string): Promise<string | null> {
    if (!companyGroupId) {
      return null;
    }
    const branch = await this.branchesService.findByCompanyGroupAndName(companyGroupId, unit);
    return branch?.id ?? null;
  }
}

export type { WorkPermitGasReading };
