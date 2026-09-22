import { CompanyLocation } from '../entities/company-location.entity';

export interface CreateCompanyLocationData {
  name: string;
  riskAreas: string[];
  unit: string;
  companyGroupId?: string | null;
  branchId?: string | null;
}

export interface UpdateCompanyLocationData {
  name?: string;
  riskAreas?: string[];
  unit?: string;
  companyGroupId?: string | null;
  branchId?: string | null;
}

/**
 * Repository pattern: isolates data access for CompanyLocation from the
 * ORM choice. Only CompanyLocationsModule may depend on this token; other
 * modules go through CompanyLocationsService.
 */
export interface ICompanyLocationRepository {
  findAll(): Promise<CompanyLocation[]>;
  findById(id: string): Promise<CompanyLocation | null>;
  create(data: CreateCompanyLocationData): Promise<CompanyLocation>;
  update(id: string, data: UpdateCompanyLocationData): Promise<CompanyLocation | null>;
  delete(id: string): Promise<boolean>;
}

export const COMPANY_LOCATION_REPOSITORY = Symbol('COMPANY_LOCATION_REPOSITORY');
