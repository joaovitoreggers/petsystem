import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyLocationsService } from './company-locations.service';
import { CompanyLocation } from './entities/company-location.entity';
import { ICompanyLocationRepository } from './repositories/company-location-repository.interface';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function companyLocation(overrides: Partial<CompanyLocation>): CompanyLocation {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Silo de milho 04',
    riskAreas: ['confinado'],
    unit: 'Matelândia',
    companyGroupId: GROUP_ID,
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('CompanyLocationsService', () => {
  let service: CompanyLocationsService;
  let repository: jest.Mocked<ICompanyLocationRepository>;
  let branchesService: jest.Mocked<BranchesService>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    branchesService = {
      findByCompanyGroupAndName: jest.fn().mockResolvedValue(null),
      findByCompanyGroup: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<BranchesService>;
    service = new CompanyLocationsService(repository, branchesService);
  });

  describe('create', () => {
    it('creates the location when a company group can be determined from the scope', async () => {
      const created = companyLocation({});
      repository.create.mockResolvedValue(created);

      const result = await service.create(
        { name: 'Silo de milho 04', riskAreas: ['confinado'], unit: 'Matelândia' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(result).toBe(created);
    });

    it('rejects when no company group can be determined at all', async () => {
      await expect(
        service.create({ name: 'Silo de milho 04', riskAreas: ['confinado'], unit: 'Matelândia' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('resolves branchId by matching unit against the caller company group branches', async () => {
      repository.create.mockResolvedValue(companyLocation({}));
      branchesService.findByCompanyGroupAndName.mockResolvedValue({
        id: 'branch-1',
        companyGroupId: GROUP_ID,
        name: 'Matelândia',
        createdAt: new Date(),
      });

      await service.create(
        { name: 'Silo de milho 04', riskAreas: ['confinado'], unit: 'Matelândia' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(branchesService.findByCompanyGroupAndName).toHaveBeenCalledWith(GROUP_ID, 'Matelândia');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: GROUP_ID, branchId: 'branch-1' }),
      );
    });

    it('leaves branchId null when no branch in the group matches the unit name', async () => {
      repository.create.mockResolvedValue(companyLocation({}));
      branchesService.findByCompanyGroupAndName.mockResolvedValue(null);

      await service.create(
        { name: 'Silo de milho 04', riskAreas: ['confinado'], unit: 'Unidade Inexistente' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
    });

    it('respects an explicit companyGroupId/branchId instead of the scope (used by the seed migration)', async () => {
      repository.create.mockResolvedValue(companyLocation({}));

      await service.create({
        name: 'Silo de milho 04',
        riskAreas: ['confinado'],
        unit: 'Matelândia',
        companyGroupId: 'explicit-group',
        branchId: 'explicit-branch',
      });

      expect(branchesService.findByCompanyGroupAndName).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: 'explicit-group', branchId: 'explicit-branch' }),
      );
    });
  });

  describe('update — tenant isolation', () => {
    it('rejects editing a location from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(companyLocation({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('a branch-restricted caller cannot edit a location from a sibling branch in the same group', async () => {
      repository.findById.mockResolvedValue(companyLocation({ companyGroupId: GROUP_ID, branchId: 'b2' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: 'b1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lets platform-admin edit a location from any tenant', async () => {
      repository.findById.mockResolvedValue(companyLocation({ companyGroupId: 'other-group' }));
      repository.update.mockResolvedValue(companyLocation({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Ok' },
          { role: 'platform-admin', companyGroupId: null, branchId: null },
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('delete — tenant isolation', () => {
    it('rejects deleting a location from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(companyLocation({ companyGroupId: 'other-group' }));

      await expect(
        service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
          role: 'gestor',
          companyGroupId: GROUP_ID,
          branchId: null,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll (tenant scoping)', () => {
    it('returns every location when there is no scope', async () => {
      const locations = [companyLocation({ id: '1' }), companyLocation({ id: '2' })];
      repository.findAll.mockResolvedValue(locations);

      await expect(service.findAll()).resolves.toEqual(locations);
    });

    it('restricts a branch-scoped caller to only their own branch', async () => {
      const locations = [
        companyLocation({ id: '1', branchId: 'b1' }),
        companyLocation({ id: '2', branchId: 'b2' }),
      ];
      repository.findAll.mockResolvedValue(locations);

      const result = await service.findAll({ role: 'tecnico', companyGroupId: GROUP_ID, branchId: 'b1' });

      expect(result.map((l) => l.id)).toEqual(['1']);
    });

    it('restricts a group-wide caller to locations of their own company group, regardless of branch', async () => {
      const locations = [
        companyLocation({ id: '1', companyGroupId: GROUP_ID, branchId: 'b1' }),
        companyLocation({ id: '2', companyGroupId: GROUP_ID, branchId: null }),
        companyLocation({ id: '3', companyGroupId: 'other-group', branchId: null }),
      ];
      repository.findAll.mockResolvedValue(locations);

      const result = await service.findAll({ role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(result.map((l) => l.id)).toEqual(['1', '2']);
    });
  });
});
