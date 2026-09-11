import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BranchesService } from '../tenancy/branches.service';
import { WorkPermit } from './entities/work-permit.entity';
import { IWorkPermitRepository } from './repositories/work-permit-repository.interface';
import { WorkPermitsService } from './work-permits.service';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function workPermit(overrides: Partial<WorkPermit>): WorkPermit {
  return {
    id: 'PET-2026-0419',
    areas: ['confinado'],
    location: 'Silo de milho 04',
    unit: 'Matelândia',
    companyGroupId: GROUP_ID,
    branchId: null,
    teamSize: 3,
    date: '2026-09-05',
    start: '09:42',
    end: '',
    timeLabel: '09:42',
    technician: 'Bárbara M. Garlini',
    status: 'aberta',
    coordinates: '',
    alarm: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('WorkPermitsService', () => {
  let service: WorkPermitsService;
  let repository: jest.Mocked<IWorkPermitRepository>;
  let branchesService: jest.Mocked<BranchesService>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      close: jest.fn(),
      addReading: jest.fn(),
      updateTenancy: jest.fn(),
    };
    branchesService = {
      findByCompanyGroupAndName: jest.fn().mockResolvedValue(null),
      findByCompanyGroup: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<BranchesService>;
    service = new WorkPermitsService(repository, branchesService);
  });

  describe('create', () => {
    it('delegates creation to the repository', async () => {
      const created = workPermit({});
      repository.create.mockResolvedValue(created);

      const result = await service.create(
        {
          areas: ['confinado'],
          location: 'Silo de milho 04',
          unit: 'Matelândia',
          teamSize: 3,
          date: '2026-09-05',
          start: '09:42',
          timeLabel: '09:42',
          technician: 'Bárbara M. Garlini',
        },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(result).toBe(created);
      expect(repository.create).toHaveBeenCalled();
    });

    it('rejects when no company group can be determined at all', async () => {
      await expect(
        service.create({
          areas: ['confinado'],
          location: 'Silo de milho 04',
          unit: 'Matelândia',
          teamSize: 3,
          date: '2026-09-05',
          start: '09:42',
          timeLabel: '09:42',
          technician: 'Bárbara M. Garlini',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('resolves branchId by matching unit against the caller company group branches', async () => {
      repository.create.mockResolvedValue(workPermit({}));
      branchesService.findByCompanyGroupAndName.mockResolvedValue({
        id: 'branch-1',
        companyGroupId: GROUP_ID,
        name: 'Matelândia',
        createdAt: new Date(),
      });

      await service.create(
        {
          areas: ['confinado'],
          location: 'Silo de milho 04',
          unit: 'Matelândia',
          teamSize: 3,
          date: '2026-09-05',
          start: '09:42',
          timeLabel: '09:42',
          technician: 'Bárbara M. Garlini',
        },
        { role: 'tecnico', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(branchesService.findByCompanyGroupAndName).toHaveBeenCalledWith(GROUP_ID, 'Matelândia');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: GROUP_ID, branchId: 'branch-1' }),
      );
    });

    it('respects an explicit companyGroupId/branchId (used by the seed migration) instead of re-resolving it', async () => {
      repository.create.mockResolvedValue(workPermit({}));

      await service.create({
        areas: ['confinado'],
        location: 'Silo de milho 04',
        unit: 'Matelândia',
        teamSize: 3,
        date: '2026-09-05',
        start: '09:42',
        timeLabel: '09:42',
        technician: 'Bárbara M. Garlini',
        companyGroupId: 'explicit-group',
        branchId: 'explicit-branch',
      });

      expect(branchesService.findByCompanyGroupAndName).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: 'explicit-group', branchId: 'explicit-branch' }),
      );
    });
  });

  describe('close — tenant isolation', () => {
    it('throws NotFoundException when the permit does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.close('unknown-id', { end: '10:00', durationMinutes: 30 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the closed permit when it exists', async () => {
      repository.findById.mockResolvedValue(workPermit({}));
      const closed = workPermit({ status: 'fechada', end: '10:00', durationMinutes: 30 });
      repository.close.mockResolvedValue(closed);

      const result = await service.close('PET-2026-0419', { end: '10:00', durationMinutes: 30 });

      expect(result).toBe(closed);
    });

    it('rejects closing a PET that belongs to a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(workPermit({ companyGroupId: 'other-group' }));

      await expect(
        service.close(
          'PET-2026-0419',
          { end: '10:00', durationMinutes: 30 },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.close).not.toHaveBeenCalled();
    });
  });

  describe('addReading — tenant isolation', () => {
    it('rejects adding a reading to a PET from a different tenant', async () => {
      repository.findById.mockResolvedValue(workPermit({ companyGroupId: 'other-group' }));

      await expect(
        service.addReading(
          'PET-2026-0419',
          { gas: { o2: 20.9, co: 0, h2s: 0, lel: 0 } },
          { role: 'tecnico', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.addReading).not.toHaveBeenCalled();
    });
  });

  describe('findAll (tenant scoping)', () => {
    it('returns every permit for platform-admin, regardless of tenant', async () => {
      const permits = [
        workPermit({ id: 'p1', companyGroupId: GROUP_ID }),
        workPermit({ id: 'p2', companyGroupId: 'other-group' }),
      ];
      repository.findAll.mockResolvedValue(permits);

      await expect(
        service.findAll({ role: 'platform-admin', companyGroupId: null, branchId: null }),
      ).resolves.toEqual(permits);
    });

    it('restricts a branch-scoped caller to only their own branch', async () => {
      const permits = [
        workPermit({ id: 'p1', branchId: 'b1' }),
        workPermit({ id: 'p2', branchId: 'b2' }),
      ];
      repository.findAll.mockResolvedValue(permits);

      const result = await service.findAll({ role: 'tecnico', companyGroupId: GROUP_ID, branchId: 'b1' });

      expect(result.map((p: WorkPermit) => p.id)).toEqual(['p1']);
    });

    it('restricts a group-wide caller to permits of their own company group, regardless of branch', async () => {
      const permits = [
        workPermit({ id: 'p1', companyGroupId: GROUP_ID, branchId: 'b1' }),
        workPermit({ id: 'p2', companyGroupId: GROUP_ID, branchId: null }),
        workPermit({ id: 'p3', companyGroupId: 'other-group', branchId: null }),
      ];
      repository.findAll.mockResolvedValue(permits);

      const result = await service.findAll({ role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(result.map((p: WorkPermit) => p.id)).toEqual(['p1', 'p2']);
    });
  });
});
