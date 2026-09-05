import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Employee } from './entities/employee.entity';
import {
  EMPLOYEE_REPOSITORY,
  IEmployeeRepository,
} from './repositories/employee-repository.interface';

export interface CreateEmployeeInput {
  name: string;
  role: string;
  canAccessRiskAreas?: boolean;
  canPerformCorrectiveService?: boolean;
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

  findAll(): Promise<Employee[]> {
    return this.employeeRepository.findAll();
  }

  findById(id: string): Promise<Employee | null> {
    return this.employeeRepository.findById(id);
  }

  create(data: CreateEmployeeInput): Promise<Employee> {
    return this.employeeRepository.create({
      name: data.name,
      role: data.role,
      canAccessRiskAreas: data.canAccessRiskAreas ?? false,
      canPerformCorrectiveService: data.canPerformCorrectiveService ?? false,
    });
  }

  async update(id: string, data: UpdateEmployeeInput): Promise<Employee> {
    const updated = await this.employeeRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException('Funcionário não encontrado');
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.employeeRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException('Funcionário não encontrado');
    }
  }
}
