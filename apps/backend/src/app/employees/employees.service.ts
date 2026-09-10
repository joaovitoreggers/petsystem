import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
import { Employee } from './entities/employee.entity';
import {
  EMPLOYEE_REPOSITORY,
  IEmployeeRepository,
} from './repositories/employee-repository.interface';

const NOT_FOUND_MESSAGE = 'Funcionário não encontrado';

export interface CreateEmployeeInput {
  name: string;
  role: string;
  canAccessRiskAreas?: boolean;
  canPerformCorrectiveService?: boolean;
  companyGroupId?: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  role?: string;
  canAccessRiskAreas?: boolean;
  canPerformCorrectiveService?: boolean;
}

/**
 * Public boundary of EmployeesModule. QrValidationModule depends only on
 * this service, never on IEmployeeRepository directly.
 */
@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly employeeRepository: IEmployeeRepository,
  ) {}

  async findAll(scope?: TenantScope): Promise<Employee[]> {
    const employees = await this.employeeRepository.findAll();
    return filterOwnedByScope(employees, scope);
  }

  async findById(id: string, scope?: TenantScope): Promise<Employee | null> {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      return null;
    }
    assertOwnedByScope(employee, scope, NOT_FOUND_MESSAGE);
    return employee;
  }

  // Sem campo de unidade em texto livre no cadastro de funcionário (o
  // crachá nunca teve um), então — diferente de TeamMember/WorkPermit —
  // não há nome pra casar com uma filial. `branchId` só existe quando quem
  // está cadastrando já estava restrito a uma filial específica.
  async create(data: CreateEmployeeInput, scope?: TenantScope): Promise<Employee> {
    const companyGroupId = data.companyGroupId ?? scope?.companyGroupId ?? null;
    if (!companyGroupId) {
      throw new BadRequestException(
        'Não foi possível determinar o grupo de empresas deste funcionário',
      );
    }
    return this.employeeRepository.create({
      name: data.name,
      role: data.role,
      canAccessRiskAreas: data.canAccessRiskAreas ?? false,
      canPerformCorrectiveService: data.canPerformCorrectiveService ?? false,
      companyGroupId,
      branchId: scope?.branchId ?? null,
    });
  }

  async update(id: string, data: UpdateEmployeeInput, scope?: TenantScope): Promise<Employee> {
    const current = await this.employeeRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const updated = await this.employeeRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  async delete(id: string, scope?: TenantScope): Promise<void> {
    const current = await this.employeeRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    await this.employeeRepository.delete(id);
  }

  // Só para a migração do seed: preenche grupo/filial em funcionários que
  // já existiam antes da multi-tenancy.
  async backfillTenancy(
    id: string,
    data: { companyGroupId: string | null; branchId: string | null },
  ): Promise<void> {
    await this.employeeRepository.update(id, data);
  }
}
