import { CompanyGroup } from '../entities/company-group.entity';

export interface CreateCompanyGroupData {
  name: string;
}

export interface UpdateCompanyGroupData {
  name?: string;
}

/**
 * Repository pattern: isolates data access for CompanyGroup from the ORM
 * choice. Only TenancyModule may depend on this token; other modules go
 * through CompanyGroupsService.
 */
export interface ICompanyGroupRepository {
  findAll(): Promise<CompanyGroup[]>;
  findById(id: string): Promise<CompanyGroup | null>;
  create(data: CreateCompanyGroupData): Promise<CompanyGroup>;
  update(id: string, data: UpdateCompanyGroupData): Promise<CompanyGroup | null>;
  delete(id: string): Promise<boolean>;
}

export const COMPANY_GROUP_REPOSITORY = Symbol('COMPANY_GROUP_REPOSITORY');
