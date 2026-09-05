import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../entities/employee.entity';
import {
  CreateEmployeeData,
  IEmployeeRepository,
  UpdateEmployeeData,
} from './employee-repository.interface';

@Injectable()
export class EmployeeRepository implements IEmployeeRepository {
  constructor(
    @InjectRepository(Employee)
    private readonly repository: Repository<Employee>,
  ) {}

  findAll(): Promise<Employee[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Employee | null> {
    return this.repository.findOneBy({ id });
  }

  create(data: CreateEmployeeData): Promise<Employee> {
    const employee = this.repository.create({
      id: randomUUID(),
      name: data.name,
      role: data.role,
      canAccessRiskAreas: data.canAccessRiskAreas,
      canPerformCorrectiveService: data.canPerformCorrectiveService,
    });
    return this.repository.save(employee);
  }

  async update(id: string, data: UpdateEmployeeData): Promise<Employee | null> {
    const employee = await this.repository.findOneBy({ id });
    if (!employee) {
      return null;
    }
    if (data.name !== undefined) employee.name = data.name;
    if (data.role !== undefined) employee.role = data.role;
    if (data.canAccessRiskAreas !== undefined) employee.canAccessRiskAreas = data.canAccessRiskAreas;
    if (data.canPerformCorrectiveService !== undefined) {
      employee.canPerformCorrectiveService = data.canPerformCorrectiveService;
    }
    return this.repository.save(employee);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
