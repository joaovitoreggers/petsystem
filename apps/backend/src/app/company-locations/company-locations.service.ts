import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyLocation } from './entities/company-location.entity';
import {
  COMPANY_LOCATION_REPOSITORY,
  CreateCompanyLocationData,
  ICompanyLocationRepository,
  UpdateCompanyLocationData,
} from './repositories/company-location-repository.interface';

export type CreateCompanyLocationInput = CreateCompanyLocationData;
export type UpdateCompanyLocationInput = UpdateCompanyLocationData;

const NOT_FOUND_MESSAGE = 'Local não encontrado';

/**
 * Público boundary de CompanyLocationsModule — controllers só dependem
 * deste service.
 */
@Injectable()
export class CompanyLocationsService {
  constructor(
    @Inject(COMPANY_LOCATION_REPOSITORY)
    private readonly companyLocationRepository: ICompanyLocationRepository,
    private readonly branchesService: BranchesService,
  ) {}

  async findAll(scope?: TenantScope): Promise<CompanyLocation[]> {
    const locations = await this.companyLocationRepository.findAll();
    return filterOwnedByScope(locations, scope);
  }

  async create(data: CreateCompanyLocationInput, scope?: TenantScope): Promise<CompanyLocation> {
    const companyGroupId = data.companyGroupId ?? scope?.companyGroupId ?? null;
    if (!companyGroupId) {
      throw new BadRequestException(
        'Não foi possível determinar o grupo de empresas deste cadastro',
      );
    }
    const branchId =
      data.branchId !== undefined ? data.branchId : await this.resolveBranchId(companyGroupId, data.unit);
    return this.companyLocationRepository.create({ ...data, companyGroupId, branchId });
  }

  async update(id: string, data: UpdateCompanyLocationInput, scope?: TenantScope): Promise<CompanyLocation> {
    const current = await this.companyLocationRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const branchId =
      data.unit !== undefined
        ? await this.resolveBranchId(current.companyGroupId, data.unit)
        : undefined;
    const updated = await this.companyLocationRepository.update(id, {
      ...data,
      ...(branchId !== undefined ? { branchId } : {}),
    });
    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  async delete(id: string, scope?: TenantScope): Promise<void> {
    const current = await this.companyLocationRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    await this.companyLocationRepository.delete(id);
  }

  // Tenta casar o texto livre `unit` com uma filial cadastrada no grupo
  // dono do registro — mesma aproximação usada por TeamMembersService.
  private async resolveBranchId(companyGroupId: string | null, unit: string): Promise<string | null> {
    if (!companyGroupId) {
      return null;
    }
    const branch = await this.branchesService.findByCompanyGroupAndName(companyGroupId, unit);
    return branch?.id ?? null;
  }
}
