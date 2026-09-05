import { NotFoundException } from '@nestjs/common';
import { Employee } from './entities/employee.entity';
import { EmployeesService } from './employees.service';
import { IEmployeeRepository } from './repositories/employee-repository.interface';

function employee(overrides: Partial<Employee>): Employee {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Test',
    role: 'tecnico',
    canAccessRiskAreas: false,
    canPerformCorrectiveService: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repository: jest.Mocked<IEmployeeRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new EmployeesService(repository);
  });

  describe('create', () => {
    it('defaults both permissions to false when omitted', async () => {
      repository.create.mockResolvedValue(employee({}));

      await service.create({ name: 'Novo', role: 'tecnico' });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Novo',
        role: 'tecnico',
        canAccessRiskAreas: false,
        canPerformCorrectiveService: false,
      });
    });

    it('keeps the two permissions independent of each other', async () => {
      repository.create.mockResolvedValue(employee({}));

      await service.create({
        name: 'Novo',
        role: 'tecnico',
        canAccessRiskAreas: true,
        canPerformCorrectiveService: false,
      });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Novo',
        role: 'tecnico',
        canAccessRiskAreas: true,
        canPerformCorrectiveService: false,
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the employee does not exist', async () => {
      repository.update.mockResolvedValue(null);

      await expect(
        service.update('unknown-id', { name: 'Novo Nome' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('only touches the fields provided', async () => {
      repository.update.mockResolvedValue(employee({}));

      await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        canPerformCorrectiveService: true,
      });

      expect(repository.update).toHaveBeenCalledWith(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        { canPerformCorrectiveService: true },
      );
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when the employee does not exist', async () => {
      repository.delete.mockResolvedValue(false);

      await expect(service.delete('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('resolves when the employee is deleted', async () => {
      repository.delete.mockResolvedValue(true);

      await expect(
        service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      ).resolves.toBeUndefined();
    });
  });
});
