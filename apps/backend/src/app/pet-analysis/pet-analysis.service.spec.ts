import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkPermit } from '../work-permits/entities/work-permit.entity';
import { WorkPermitsService } from '../work-permits/work-permits.service';
import { PetAnalysisService } from './pet-analysis.service';

function permit(overrides: Partial<WorkPermit>): WorkPermit {
  return {
    id: 'PET-2026-0418',
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

function configService(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string, defaultValue?: string) => values[key] ?? defaultValue } as unknown as ConfigService;
}

describe('PetAnalysisService', () => {
  describe('without OPENAI_API_KEY configured', () => {
    it('throws ServiceUnavailableException instead of calling OpenAI', async () => {
      const workPermitsService = { findAll: jest.fn() } as unknown as WorkPermitsService;
      const service = new PetAnalysisService(workPermitsService, configService({}));

      await expect(service.analyze()).rejects.toThrow(ServiceUnavailableException);
      expect(workPermitsService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('buildSummary (via a spy on the OpenAI client)', () => {
    it('flags a day with much more volume than average as unusual', async () => {
      const workPermitsService = {
        findAll: jest.fn().mockResolvedValue([
          permit({ id: 'a', date: '2026-09-01', areas: ['confinado'], status: 'fechada' }),
          permit({ id: 'b', date: '2026-09-02', areas: ['confinado'], status: 'fechada' }),
          permit({ id: 'c', date: '2026-09-03', areas: ['confinado'], status: 'aberta' }),
          permit({ id: 'd', date: '2026-09-03', areas: ['quente'], status: 'aberta' }),
          permit({ id: 'e', date: '2026-09-03', areas: ['maquinas'], status: 'ocorrencia' }),
        ]),
      } as unknown as WorkPermitsService;
      const service = new PetAnalysisService(workPermitsService, configService({ OPENAI_API_KEY: 'test-key' }));

      const createMock = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'relatório de teste' } }] });
      (service as unknown as { client: { chat: { completions: { create: typeof createMock } } } }).client = {
        chat: { completions: { create: createMock } },
      };

      const result = await service.analyze();

      expect(result.summary.totalCount).toBe(5);
      expect(result.summary.unusualDays.map((d) => d.date)).toContain('2026-09-03');
      expect(result.reportText).toBe('relatório de teste');
      expect(createMock).toHaveBeenCalledTimes(1);
    });
  });
});
