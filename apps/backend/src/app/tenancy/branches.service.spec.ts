import { ConflictException, NotFoundException } from '@nestjs/common';
import { Branch } from './entities/branch.entity';
import { IBranchRepository } from './repositories/branch-repository.interface';
import { BranchesService } from './branches.service';
import { TenancyReferenceGuardService } from './tenancy-reference-guard.service';

function branch(overrides: Partial<Branch>): Branch {
  return { id: 'b1', companyGroupId: 'g1', name: 'Matelândia', createdAt: new Date(), ...overrides };
}

describe('BranchesService', () => {
  let service: BranchesService;
  let repository: jest.Mocked<IBranchRepository>;
  let referenceGuard: jest.Mocked<Pick<TenancyReferenceGuardService, 'branchHasReferences'>>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCompanyGroup: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    referenceGuard = { branchHasReferences: jest.fn().mockResolvedValue(false) };
    service = new BranchesService(repository, referenceGuard as unknown as TenancyReferenceGuardService);
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

  describe('update', () => {
    it('renames the branch', async () => {
      repository.update.mockResolvedValue(branch({ name: 'Novo Nome' }));

      await expect(service.update('b1', { name: 'Novo Nome' })).resolves.toMatchObject({
        name: 'Novo Nome',
      });
    });

    it('throws NotFoundException when the branch does not exist', async () => {
      repository.update.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when the branch does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('rejects deletion when the branch still has references (user, PET, or employee)', async () => {
      repository.findById.mockResolvedValue(branch({}));
      referenceGuard.branchHasReferences.mockResolvedValue(true);

      await expect(service.delete('b1')).rejects.toThrow(ConflictException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes the branch when nothing references it', async () => {
      repository.findById.mockResolvedValue(branch({}));
      referenceGuard.branchHasReferences.mockResolvedValue(false);
      repository.delete.mockResolvedValue(true);

      await service.delete('b1');

      expect(repository.delete).toHaveBeenCalledWith('b1');
    });
  });
});
