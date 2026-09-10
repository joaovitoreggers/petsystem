import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyGroup } from './entities/company-group.entity';
import {
  COMPANY_GROUP_REPOSITORY,
  ICompanyGroupRepository,
} from './repositories/company-group-repository.interface';
import { TenancyReferenceGuardService } from './tenancy-reference-guard.service';

export interface CreateCompanyGroupInput {
  name: string;
}

export interface UpdateCompanyGroupInput {
  name?: string;
}

/**
 * Público boundary de grupos de empresas (tenants) — controllers e outros
 * módulos só dependem deste service.
 */
@Injectable()
export class CompanyGroupsService {
  constructor(
    @Inject(COMPANY_GROUP_REPOSITORY)
    private readonly companyGroupRepository: ICompanyGroupRepository,
    private readonly referenceGuard: TenancyReferenceGuardService,
  ) {}

  findAll(): Promise<CompanyGroup[]> {
    return this.companyGroupRepository.findAll();
  }

  findById(id: string): Promise<CompanyGroup | null> {
    return this.companyGroupRepository.findById(id);
  }

  async getByIdOrFail(id: string): Promise<CompanyGroup> {
    const group = await this.companyGroupRepository.findById(id);
    if (!group) {
      throw new NotFoundException('Grupo de empresas não encontrado');
    }
    return group;
  }

  create(data: CreateCompanyGroupInput): Promise<CompanyGroup> {
    return this.companyGroupRepository.create(data);
  }

  async update(id: string, data: UpdateCompanyGroupInput): Promise<CompanyGroup> {
    const updated = await this.companyGroupRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException('Grupo de empresas não encontrado');
    }
    return updated;
  }

  // Bloqueia em vez de deixar órfão: um grupo com filiais, usuários, PETs
  // ou funcionários ainda vinculados não pode sumir de baixo deles.
  async delete(id: string): Promise<void> {
    await this.getByIdOrFail(id);
    const hasReferences = await this.referenceGuard.companyGroupHasReferences(id);
    if (hasReferences) {
      throw new ConflictException(
        'Não é possível excluir: ainda há filiais, usuários, PETs ou funcionários vinculados a este grupo',
      );
    }
    await this.companyGroupRepository.delete(id);
  }
}
