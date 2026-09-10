import { Employee } from '../entities/employee.entity';

export interface CreateEmployeeData {
  name: string;
  role: string;
  canAccessRiskAreas: boolean;
  canPerformCorrectiveService: boolean;
  companyGroupId: string | null;
  branchId: string | null;
}

export interface UpdateEmployeeData {
  name?: string;
  role?: string;
  canAccessRiskAreas?: boolean;
  canPerformCorrectiveService?: boolean;
  companyGroupId?: string | null;
  branchId?: string | null;
}

/**
 * Repository pattern: isolates data access for Employee from the ORM choice.
 * Only EmployeesModule may depend on this token; other modules go through
 * EmployeesService.
 */
export interface IEmployeeRepository {
  findAll(): Promise<Employee[]>;
  findById(id: string): Promise<Employee | null>;
  create(data: CreateEmployeeData): Promise<Employee>;
  update(id: string, data: UpdateEmployeeData): Promise<Employee | null>;
  delete(id: string): Promise<boolean>;
}

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');
