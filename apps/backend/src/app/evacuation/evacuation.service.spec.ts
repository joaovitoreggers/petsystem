import { NotFoundException } from '@nestjs/common';
import { EmergencyContact } from '../emergency-contacts/entities/emergency-contact.entity';
import { EmergencyContactsService } from '../emergency-contacts/emergency-contacts.service';
import { WorkPermit } from '../work-permits/entities/work-permit.entity';
import { WorkPermitsService } from '../work-permits/work-permits.service';
import { EvacuationService } from './evacuation.service';
import { EvacuationAlert } from './entities/evacuation-alert.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { IEvacuationAlertRepository } from './repositories/evacuation-alert-repository.interface';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function alert(overrides: Partial<EvacuationAlert>): EvacuationAlert {
  return {
    id: 'alert-1',
    workPermitId: null,
    companyGroupId: GROUP_ID,
    branchId: null,
    triggeredAt: new Date('2026-09-23T12:00:00Z'),
    resolvedAt: null,
    ...overrides,
  };
}

function permit(overrides: Partial<WorkPermit>): WorkPermit {
  return {
    id: 'PET-2026-0001',
    areas: ['confinado'],
    location: 'Silo 04',
    unit: 'Matelândia',
    companyGroupId: GROUP_ID,
    branchId: null,
    teamSize: 3,
    date: '2026-09-23',
    start: '08:00',
    end: '',
    timeLabel: '08:00',
    technician: 'João',
    status: 'aberta',
    coordinates: '',
    alarm: false,
    createdAt: new Date(),
    ...overrides,
  } as WorkPermit;
}

function contact(overrides: Partial<EmergencyContact>): EmergencyContact {
  return {
    id: 'contact-1',
    name: 'Marina',
    phone: '+5545999999999',
    companyGroupId: GROUP_ID,
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('EvacuationService', () => {
  let service: EvacuationService;
  let repository: jest.Mocked<IEvacuationAlertRepository>;
  let workPermitsService: jest.Mocked<Pick<WorkPermitsService, 'findById' | 'findAll'>>;
  let emergencyContactsService: jest.Mocked<Pick<EmergencyContactsService, 'findAll'>>;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'buildStatusLink' | 'notifyContacts'>>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      create: jest.fn(),
      markResolved: jest.fn(),
    };
    workPermitsService = { findById: jest.fn(), findAll: jest.fn() };
    emergencyContactsService = { findAll: jest.fn().mockResolvedValue([]) };
    notificationsService = {
      buildStatusLink: jest.fn((id: string) => `http://app/status/${id}`),
      notifyContacts: jest.fn().mockResolvedValue([]),
    };
    service = new EvacuationService(
      repository,
      workPermitsService as unknown as WorkPermitsService,
      emergencyContactsService as unknown as EmergencyContactsService,
      notificationsService as unknown as NotificationsService,
    );
  });

  describe('trigger', () => {
    it('creates an alert without a work permit when none is given', async () => {
      repository.create.mockResolvedValue(alert({ id: 'alert-1' }));

      const result = await service.trigger(null, { role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workPermitId: null, companyGroupId: GROUP_ID }),
      );
      expect(result.alertId).toBe('alert-1');
      expect(result.statusUrl).toBe('http://app/status/alert-1');
    });

    it('looks up the work permit and notifies every contact in the caller tenant', async () => {
      const p = permit({ id: 'PET-2026-0001' });
      workPermitsService.findById.mockResolvedValue(p);
      repository.create.mockResolvedValue(alert({ id: 'alert-2', workPermitId: p.id }));
      const contacts = [contact({ id: 'c1' }), contact({ id: 'c2' })];
      emergencyContactsService.findAll.mockResolvedValue(contacts);
      notificationsService.notifyContacts.mockResolvedValue([
        { contactId: 'c1', sms: 'sent', whatsapp: 'sent' },
        { contactId: 'c2', sms: 'failed', whatsapp: 'not_configured' },
      ]);

      const result = await service.trigger('PET-2026-0001', {
        role: 'gestor',
        companyGroupId: GROUP_ID,
        branchId: null,
      });

      expect(notificationsService.notifyContacts).toHaveBeenCalledWith(
        contacts,
        expect.stringContaining('Silo 04'),
      );
      expect(result.contactsNotified).toBe(2);
      expect(result.deliveries).toHaveLength(2);
    });
  });

  describe('resolve', () => {
    it('rejects resolving an alert from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(alert({ companyGroupId: 'other-group' }));

      await expect(
        service.resolve('alert-1', { role: 'gestor', companyGroupId: GROUP_ID, branchId: null }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.markResolved).not.toHaveBeenCalled();
    });

    it('marks the alert resolved for a caller in the same tenant', async () => {
      repository.findById.mockResolvedValue(alert({ companyGroupId: GROUP_ID }));

      await service.resolve('alert-1', { role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(repository.markResolved).toHaveBeenCalledWith('alert-1');
    });
  });

  describe('getPublicStatus', () => {
    it('returns null for an unknown token', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getPublicStatus('nope')).resolves.toBeNull();
    });

    it('returns the work permit snapshot when the alert targets one', async () => {
      repository.findById.mockResolvedValue(alert({ workPermitId: 'PET-2026-0001' }));
      workPermitsService.findById.mockResolvedValue(permit({ id: 'PET-2026-0001' }));

      const status = await service.getPublicStatus('alert-1');

      expect(status?.workPermit?.location).toBe('Silo 04');
      expect(status?.summary).toBeNull();
    });

    it('returns an open-permits summary when the alert has no specific work permit', async () => {
      repository.findById.mockResolvedValue(alert({ workPermitId: null }));
      workPermitsService.findAll.mockResolvedValue([
        permit({ id: 'PET-2026-0001', status: 'aberta', teamSize: 2, unit: 'Matelândia' }),
        permit({ id: 'PET-2026-0002', status: 'fechada', teamSize: 5, unit: 'Medianeira' }),
      ]);

      const status = await service.getPublicStatus('alert-1');

      expect(status?.workPermit).toBeNull();
      expect(status?.summary).toEqual({ openPets: 1, peopleInField: 2, units: 1 });
    });
  });
});
