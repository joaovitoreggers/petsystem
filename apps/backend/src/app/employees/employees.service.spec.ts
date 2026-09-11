import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Employee } from './entities/employee.entity';
import { EmployeesService } from './employees.service';
import { IEmployeeRepository } from './repositories/employee-repository.interface';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function employee(overrides: Partial<Employee>): Employee {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Test',
    role: 'tecnico',
    canAccessRiskAreas: false,
    canPerformCorrectiveService: false,
    companyGroupId: GROUP_ID,
    branchId: null,
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

      await service.create(
        { name: 'Novo', role: 'tecnico' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Novo',
        role: 'tecnico',
        canAccessRiskAreas: false,
        canPerformCorrectiveService: false,
        companyGroupId: GROUP_ID,
        branchId: null,
      });
    });

    it('keeps the two permissions independent of each other', async () => {
      repository.create.mockResolvedValue(employee({}));

      await service.create(
        {
          name: 'Novo',
          role: 'tecnico',
          canAccessRiskAreas: true,
          canPerformCorrectiveService: false,
        },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Novo',
        role: 'tecnico',
        canAccessRiskAreas: true,
        canPerformCorrectiveService: false,
        companyGroupId: GROUP_ID,
        branchId: null,
      });
    });

    it('inherits branchId from a branch-restricted caller', async () => {
      repository.create.mockResolvedValue(employee({ branchId: 'b1' }));

      await service.create(
        { name: 'Novo', role: 'tecnico' },
        { role: 'tecnico', companyGroupId: GROUP_ID, branchId: 'b1' },
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: GROUP_ID, branchId: 'b1' }),
      );
    });

    it('rejects when no company group can be determined at all', async () => {
      await expect(service.create({ name: 'Novo', role: 'tecnico' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the employee does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('unknown-id', { name: 'Novo Nome' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('only touches the fields provided', async () => {
      repository.findById.mockResolvedValue(employee({}));
      repository.update.mockResolvedValue(employee({}));

      await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        canPerformCorrectiveService: true,
      });

      expect(repository.update).toHaveBeenCalledWith(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        { canPerformCorrectiveService: true },
      );
    });

    it('rejects editing an employee that belongs to a different tenant', async () => {
      repository.findById.mockResolvedValue(employee({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('lets platform-admin edit an employee from any tenant', async () => {
      repository.findById.mockResolvedValue(employee({ companyGroupId: 'other-group' }));
      repository.update.mockResolvedValue(employee({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Ok' },
          { role: 'platform-admin', companyGroupId: null, branchId: null },
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when the employee does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('resolves when the employee is deleted', async () => {
      repository.findById.mockResolvedValue(employee({}));
      repository.delete.mockResolvedValue(true);

      await expect(
        service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      ).resolves.toBeUndefined();
    });

    it('rejects deleting an employee that belongs to a different tenant', async () => {
      repository.findById.mockResolvedValue(employee({ companyGroupId: 'other-group' }));

      await expect(
        service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
          role: 'admin',
          companyGroupId: GROUP_ID,
          branchId: null,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll (tenant scoping)', () => {
    it('restricts a group-wide caller to their own company group', async () => {
      const employees = [
        employee({ id: '1', companyGroupId: GROUP_ID }),
        employee({ id: '2', companyGroupId: 'other-group' }),
      ];
      repository.findAll.mockResolvedValue(employees);

      const result = await service.findAll({ role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(result.map((e) => e.id)).toEqual(['1']);
    });
  });
});
