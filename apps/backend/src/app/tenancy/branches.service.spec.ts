import { NotFoundException } from '@nestjs/common';
import { Branch } from './entities/branch.entity';
import { IBranchRepository } from './repositories/branch-repository.interface';
import { BranchesService } from './branches.service';

function branch(overrides: Partial<Branch>): Branch {
  return { id: 'b1', companyGroupId: 'g1', name: 'Matelândia', createdAt: new Date(), ...overrides };
}

describe('BranchesService', () => {
  let service: BranchesService;
  let repository: jest.Mocked<IBranchRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCompanyGroup: jest.fn(),
      create: jest.fn(),
    };
    service = new BranchesService(repository);
  });

  describe('getByIdOrFail', () => {
    it('throws NotFoundException when the branch does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getByIdOrFail('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the branch when it exists', async () => {
      const found = branch({ id: 'b2' });
      repository.findById.mockResolvedValue(found);

      await expect(service.getByIdOrFail('b2')).resolves.toBe(found);
    });
  });

  describe('findByCompanyGroupAndName', () => {
    it('matches a branch name case-insensitively and ignoring surrounding whitespace', async () => {
      repository.findByCompanyGroup.mockResolvedValue([branch({ name: 'Matelândia' })]);

      const found = await service.findByCompanyGroupAndName('g1', '  MATELÂNDIA  ');

      expect(found?.id).toBe('b1');
    });

    it('returns null when no branch in the group matches the name', async () => {
      repository.findByCompanyGroup.mockResolvedValue([branch({ name: 'Matelândia' })]);

      const found = await service.findByCompanyGroupAndName('g1', 'Curitiba');

      expect(found).toBeNull();
    });

    it('returns null when the group has no branches at all', async () => {
      repository.findByCompanyGroup.mockResolvedValue([]);

      const found = await service.findByCompanyGroupAndName('g1', 'Matelândia');

      expect(found).toBeNull();
    });
  });

  it('delegates creation to the repository', async () => {
    const created = branch({});
    repository.create.mockResolvedValue(created);

    const result = await service.create({ companyGroupId: 'g1', name: 'Matelândia' });

    expect(result).toBe(created);
    expect(repository.create).toHaveBeenCalledWith({ companyGroupId: 'g1', name: 'Matelândia' });
  });
});
