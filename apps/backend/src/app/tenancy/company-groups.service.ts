import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyGroup } from './entities/company-group.entity';
import {
  COMPANY_GROUP_REPOSITORY,
  ICompanyGroupRepository,
} from './repositories/company-group-repository.interface';

export interface CreateCompanyGroupInput {
  name: string;
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
}
