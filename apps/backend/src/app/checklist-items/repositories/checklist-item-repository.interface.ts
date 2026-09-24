import { ChecklistItem } from '../entities/checklist-item.entity';

export interface CreateChecklistItemData {
  riskAreaId: string;
  label: string;
  companyGroupId: string | null;
  branchId: string | null;
}

export interface UpdateChecklistItemData {
  label?: string;
}

/**
 * Repository pattern: isolates data access for ChecklistItem from the ORM
 * choice. Only ChecklistItemsModule may depend on this token; other
 * modules go through ChecklistItemsService.
 */
export interface IChecklistItemRepository {
  findAll(): Promise<ChecklistItem[]>;
  findById(id: string): Promise<ChecklistItem | null>;
  create(data: CreateChecklistItemData): Promise<ChecklistItem>;
  update(id: string, data: UpdateChecklistItemData): Promise<ChecklistItem | null>;
  delete(id: string): Promise<void>;
}

export const CHECKLIST_ITEM_REPOSITORY = Symbol('CHECKLIST_ITEM_REPOSITORY');
