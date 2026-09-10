import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompanyGroup } from './entities/company-group.entity';
import { ICompanyGroupRepository } from './repositories/company-group-repository.interface';
import { CompanyGroupsService } from './company-groups.service';
import { TenancyReferenceGuardService } from './tenancy-reference-guard.service';

function group(overrides: Partial<CompanyGroup>): CompanyGroup {
  return { id: 'g1', name: 'Lar Cooperativa Agroindustrial', createdAt: new Date(), ...overrides };
}

describe('CompanyGroupsService', () => {
  let service: CompanyGroupsService;
  let repository: jest.Mocked<ICompanyGroupRepository>;
  let referenceGuard: jest.Mocked<Pick<TenancyReferenceGuardService, 'companyGroupHasReferences'>>;

  beforeEach(() => {
    repository = { findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
    referenceGuard = { companyGroupHasReferences: jest.fn().mockResolvedValue(false) };
    service = new CompanyGroupsService(
      repository,
      referenceGuard as unknown as TenancyReferenceGuardService,
    );
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

  describe('update', () => {
    it('renames the group', async () => {
      repository.update.mockResolvedValue(group({ name: 'Novo Nome' }));

      await expect(service.update('g1', { name: 'Novo Nome' })).resolves.toMatchObject({
        name: 'Novo Nome',
      });
    });

    it('throws NotFoundException when the group does not exist', async () => {
      repository.update.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when the group does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('rejects deletion when the group still has references (branch, user, PET, or employee)', async () => {
      repository.findById.mockResolvedValue(group({}));
      referenceGuard.companyGroupHasReferences.mockResolvedValue(true);

      await expect(service.delete('g1')).rejects.toThrow(ConflictException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes the group when nothing references it', async () => {
      repository.findById.mockResolvedValue(group({}));
      referenceGuard.companyGroupHasReferences.mockResolvedValue(false);
      repository.delete.mockResolvedValue(true);

      await service.delete('g1');

      expect(repository.delete).toHaveBeenCalledWith('g1');
    });
  });
});
