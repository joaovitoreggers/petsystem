import { NotFoundException } from '@nestjs/common';
import { CompanyGroup } from './entities/company-group.entity';
import { ICompanyGroupRepository } from './repositories/company-group-repository.interface';
import { CompanyGroupsService } from './company-groups.service';

function group(overrides: Partial<CompanyGroup>): CompanyGroup {
  return { id: 'g1', name: 'Lar Cooperativa Agroindustrial', createdAt: new Date(), ...overrides };
}

describe('CompanyGroupsService', () => {
  let service: CompanyGroupsService;
  let repository: jest.Mocked<ICompanyGroupRepository>;

  beforeEach(() => {
    repository = { findAll: jest.fn(), findById: jest.fn(), create: jest.fn() };
    service = new CompanyGroupsService(repository);
  });

  it('returns all groups from the repository', async () => {
    const groups = [group({})];
    repository.findAll.mockResolvedValue(groups);

    await expect(service.findAll()).resolves.toBe(groups);
  });

  describe('getByIdOrFail', () => {
    it('throws NotFoundException when the group does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getByIdOrFail('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the group when it exists', async () => {
      const found = group({ id: 'g2' });
      repository.findById.mockResolvedValue(found);

      await expect(service.getByIdOrFail('g2')).resolves.toBe(found);
    });
  });

  it('delegates creation to the repository', async () => {
    const created = group({});
    repository.create.mockResolvedValue(created);

    await expect(service.create({ name: created.name })).resolves.toBe(created);
    expect(repository.create).toHaveBeenCalledWith({ name: created.name });
  });
});
