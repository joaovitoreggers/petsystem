import { Branch } from '../entities/branch.entity';

export interface CreateBranchData {
  companyGroupId: string;
  name: string;
}

/**
 * Repository pattern: isolates data access for Branch from the ORM choice.
 * Only TenancyModule may depend on this token; other modules go through
 * BranchesService.
 */
export interface IBranchRepository {
  findAll(): Promise<Branch[]>;
  findById(id: string): Promise<Branch | null>;
  findByCompanyGroup(companyGroupId: string): Promise<Branch[]>;
  create(data: CreateBranchData): Promise<Branch>;
}

export const BRANCH_REPOSITORY = Symbol('BRANCH_REPOSITORY');
