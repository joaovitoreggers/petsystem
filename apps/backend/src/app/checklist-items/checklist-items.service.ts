import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
import { ChecklistItem } from './entities/checklist-item.entity';
import {
  CHECKLIST_ITEM_REPOSITORY,
  CreateChecklistItemData,
  IChecklistItemRepository,
  UpdateChecklistItemData,
} from './repositories/checklist-item-repository.interface';

export type CreateChecklistItemInput = Omit<CreateChecklistItemData, 'companyGroupId' | 'branchId'> & {
  companyGroupId?: string;
  branchId?: string;
};
export type UpdateChecklistItemInput = UpdateChecklistItemData;

const NOT_FOUND_MESSAGE = 'Item de checklist não encontrado';

/**
 * Público boundary de ChecklistItemsModule — controllers só dependem deste
 * service.
 */
@Injectable()
export class ChecklistItemsService {
  constructor(
    @Inject(CHECKLIST_ITEM_REPOSITORY)
    private readonly checklistItemRepository: IChecklistItemRepository,
  ) {}

  async findAll(scope?: TenantScope): Promise<ChecklistItem[]> {
    const items = await this.checklistItemRepository.findAll();
    return filterOwnedByScope(items, scope);
  }

  async create(data: CreateChecklistItemInput, scope?: TenantScope): Promise<ChecklistItem> {
    const companyGroupId = data.companyGroupId ?? scope?.companyGroupId ?? null;
    if (!companyGroupId) {
      throw new BadRequestException(
        'Não foi possível determinar o grupo de empresas deste item',
      );
    }
    const branchId = data.branchId ?? scope?.branchId ?? null;
    return this.checklistItemRepository.create({
      riskAreaId: data.riskAreaId,
      label: data.label,
      companyGroupId,
      branchId,
    });
  }

  async update(id: string, data: UpdateChecklistItemInput, scope?: TenantScope): Promise<ChecklistItem> {
    const current = await this.checklistItemRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const updated = await this.checklistItemRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  async delete(id: string, scope?: TenantScope): Promise<void> {
    const current = await this.checklistItemRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    await this.checklistItemRepository.delete(id);
  }
}
