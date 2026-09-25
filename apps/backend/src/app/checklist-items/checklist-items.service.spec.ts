import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChecklistItemsService } from './checklist-items.service';
import { ChecklistItem } from './entities/checklist-item.entity';
import { IChecklistItemRepository } from './repositories/checklist-item-repository.interface';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function checklistItem(overrides: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    riskAreaId: 'confinado',
    label: 'Sinalização adicional do silo conferida?',
    companyGroupId: GROUP_ID,
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ChecklistItemsService', () => {
  let service: ChecklistItemsService;
  let repository: jest.Mocked<IChecklistItemRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new ChecklistItemsService(repository);
  });

  describe('create', () => {
    it('creates the item when a company group can be determined from the scope', async () => {
      const created = checklistItem({});
      repository.create.mockResolvedValue(created);

      const result = await service.create(
        { riskAreaId: 'confinado', label: 'Sinalização adicional do silo conferida?' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(result).toBe(created);
    });

    it('rejects when no company group can be determined at all', async () => {
      await expect(
        service.create({ riskAreaId: 'confinado', label: 'Item sem grupo' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('respects an explicit companyGroupId/branchId instead of the scope', async () => {
      repository.create.mockResolvedValue(checklistItem({}));

      await service.create({
        riskAreaId: 'altura',
        label: 'Item explícito',
        companyGroupId: 'explicit-group',
        branchId: 'explicit-branch',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: 'explicit-group', branchId: 'explicit-branch' }),
      );
    });
  });

  describe('update — tenant isolation', () => {
    it('rejects editing an item from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(checklistItem({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { label: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('lets platform-admin edit an item from any tenant', async () => {
      repository.findById.mockResolvedValue(checklistItem({ companyGroupId: 'other-group' }));
      repository.update.mockResolvedValue(checklistItem({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { label: 'Ok' },
          { role: 'platform-admin', companyGroupId: null, branchId: null },
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('delete — tenant isolation', () => {
    it('rejects deleting an item from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(checklistItem({ companyGroupId: 'other-group' }));

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
    it('restricts a group-wide caller to items of their own company group', async () => {
      const items = [
        checklistItem({ id: '1', companyGroupId: GROUP_ID }),
        checklistItem({ id: '2', companyGroupId: 'other-group' }),
      ];
      repository.findAll.mockResolvedValue(items);

      const result = await service.findAll({ role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(result.map((i) => i.id)).toEqual(['1']);
    });
  });
});
