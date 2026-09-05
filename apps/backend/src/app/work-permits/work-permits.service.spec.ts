import { NotFoundException } from '@nestjs/common';
import { WorkPermit } from './entities/work-permit.entity';
import { IWorkPermitRepository } from './repositories/work-permit-repository.interface';
import { WorkPermitsService } from './work-permits.service';

function workPermit(overrides: Partial<WorkPermit>): WorkPermit {
  return {
    id: 'PET-2026-0419',
    areas: ['confinado'],
    location: 'Silo de milho 04',
    unit: 'Matelândia',
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

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      close: jest.fn(),
    };
    service = new WorkPermitsService(repository);
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
});
