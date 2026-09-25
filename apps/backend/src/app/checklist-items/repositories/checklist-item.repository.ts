import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistItem } from '../entities/checklist-item.entity';
import {
  CreateChecklistItemData,
  IChecklistItemRepository,
  UpdateChecklistItemData,
} from './checklist-item-repository.interface';

@Injectable()
export class ChecklistItemRepository implements IChecklistItemRepository {
  constructor(
    @InjectRepository(ChecklistItem)
    private readonly repository: Repository<ChecklistItem>,
  ) {}

  findAll(): Promise<ChecklistItem[]> {
    return this.repository.find({ order: { createdAt: 'ASC' } });
  }

  findById(id: string): Promise<ChecklistItem | null> {
    return this.repository.findOneBy({ id });
  }

  create(data: CreateChecklistItemData): Promise<ChecklistItem> {
    const item = this.repository.create({
      riskAreaId: data.riskAreaId,
      label: data.label,
      companyGroupId: data.companyGroupId ?? null,
      branchId: data.branchId ?? null,
    });
    return this.repository.save(item);
  }

  async update(id: string, data: UpdateChecklistItemData): Promise<ChecklistItem | null> {
    const item = await this.repository.findOneBy({ id });
    if (!item) {
      return null;
    }
    if (data.label !== undefined) item.label = data.label;
    return this.repository.save(item);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
