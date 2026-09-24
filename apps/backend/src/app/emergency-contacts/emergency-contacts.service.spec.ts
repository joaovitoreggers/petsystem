import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmergencyContactsService } from './emergency-contacts.service';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { IEmergencyContactRepository } from './repositories/emergency-contact-repository.interface';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function emergencyContact(overrides: Partial<EmergencyContact>): EmergencyContact {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Marina T. Baldissera',
    phone: '+5545999999999',
    companyGroupId: GROUP_ID,
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('EmergencyContactsService', () => {
  let service: EmergencyContactsService;
  let repository: jest.Mocked<IEmergencyContactRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new EmergencyContactsService(repository);
  });

  describe('create', () => {
    it('creates the contact when a company group can be determined from the scope', async () => {
      const created = emergencyContact({});
      repository.create.mockResolvedValue(created);

      const result = await service.create(
        { name: 'Marina T. Baldissera', phone: '+5545999999999' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(result).toBe(created);
    });

    it('rejects when no company group can be determined at all', async () => {
      await expect(
        service.create({ name: 'Marina T. Baldissera', phone: '+5545999999999' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('resolves branchId from the caller scope when not explicit', async () => {
      repository.create.mockResolvedValue(emergencyContact({}));

      await service.create(
        { name: 'Marina T. Baldissera', phone: '+5545999999999' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: 'branch-1' },
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: GROUP_ID, branchId: 'branch-1' }),
      );
    });

    it('respects an explicit companyGroupId/branchId instead of the scope', async () => {
      repository.create.mockResolvedValue(emergencyContact({}));

      await service.create({
        name: 'Marina T. Baldissera',
        phone: '+5545999999999',
        companyGroupId: 'explicit-group',
        branchId: 'explicit-branch',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: 'explicit-group', branchId: 'explicit-branch' }),
      );
    });
  });

  describe('update — tenant isolation', () => {
    it('rejects editing a contact from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(emergencyContact({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('lets platform-admin edit a contact from any tenant', async () => {
      repository.findById.mockResolvedValue(emergencyContact({ companyGroupId: 'other-group' }));
      repository.update.mockResolvedValue(emergencyContact({ companyGroupId: 'other-group' }));

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
    it('rejects deleting a contact from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(emergencyContact({ companyGroupId: 'other-group' }));

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
    it('restricts a group-wide caller to contacts of their own company group', async () => {
      const contacts = [
        emergencyContact({ id: '1', companyGroupId: GROUP_ID }),
        emergencyContact({ id: '2', companyGroupId: 'other-group' }),
      ];
      repository.findAll.mockResolvedValue(contacts);

      const result = await service.findAll({ role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(result.map((c) => c.id)).toEqual(['1']);
    });
  });
});
