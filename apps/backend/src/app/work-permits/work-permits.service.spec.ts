import { NotFoundException } from '@nestjs/common';
import { BranchesService } from '../tenancy/branches.service';
import { WorkPermit } from './entities/work-permit.entity';
import { IWorkPermitRepository } from './repositories/work-permit-repository.interface';
import { WorkPermitsService } from './work-permits.service';

function workPermit(overrides: Partial<WorkPermit>): WorkPermit {
  return {
    id: 'PET-2026-0419',
    areas: ['confinado'],
    location: 'Silo de milho 04',
    unit: 'Matelândia',
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
      updateBranch: jest.fn(),
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

      const result = await service.create({
        areas: ['confinado'],
        location: 'Silo de milho 04',
        unit: 'Matelândia',
        teamSize: 3,
        date: '2026-09-05',
        start: '09:42',
        timeLabel: '09:42',
        technician: 'Bárbara M. Garlini',
      });

      expect(result).toBe(created);
      expect(repository.create).toHaveBeenCalled();
    });

    it('resolves branchId by matching unit against the caller company group branches', async () => {
      repository.create.mockResolvedValue(workPermit({}));
      branchesService.findByCompanyGroupAndName.mockResolvedValue({
        id: 'branch-1',
        companyGroupId: 'group-1',
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
        { role: 'tecnico', companyGroupId: 'group-1', branchId: null },
      );

      expect(branchesService.findByCompanyGroupAndName).toHaveBeenCalledWith('group-1', 'Matelândia');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-1' }),
      );
    });

    it('respects an explicitly-provided branchId (used by the seed migration) instead of re-resolving it', async () => {
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
        branchId: 'explicit-branch',
      });

      expect(branchesService.findByCompanyGroupAndName).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'explicit-branch' }),
      );
    });
  });

  describe('close', () => {
    it('throws NotFoundException when the permit does not exist', async () => {
      repository.close.mockResolvedValue(null);

      await expect(service.close('unknown-id', { end: '10:00', durationMinutes: 30 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the closed permit when it exists', async () => {
      const closed = workPermit({ status: 'fechada', end: '10:00', durationMinutes: 30 });
      repository.close.mockResolvedValue(closed);

      const result = await service.close('PET-2026-0419', { end: '10:00', durationMinutes: 30 });

      expect(result).toBe(closed);
    });
  });

  describe('findAll (tenant scoping)', () => {
    it('returns every permit for platform-admin, regardless of branch', async () => {
      const permits = [workPermit({ id: 'p1', branchId: 'b1' })];
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

      const result = await service.findAll({ role: 'tecnico', companyGroupId: 'g1', branchId: 'b1' });

      expect(result.map((p: WorkPermit) => p.id)).toEqual(['p1']);
    });

    it('restricts a group-wide caller to permits of branches within their own group', async () => {
      const permits = [
        workPermit({ id: 'p1', branchId: 'b1' }),
        workPermit({ id: 'p2', branchId: 'b-other-group' }),
        workPermit({ id: 'p3', branchId: null }),
      ];
      repository.findAll.mockResolvedValue(permits);
      branchesService.findByCompanyGroup.mockResolvedValue([
        { id: 'b1', companyGroupId: 'g1', name: 'Matelândia', createdAt: new Date() },
      ]);

      const result = await service.findAll({ role: 'gestor', companyGroupId: 'g1', branchId: null });

      expect(result.map((p: WorkPermit) => p.id)).toEqual(['p1']);
    });
  });
});
