import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistItem } from './entities/checklist-item.entity';
import { CHECKLIST_ITEM_REPOSITORY } from './repositories/checklist-item-repository.interface';
import { ChecklistItemRepository } from './repositories/checklist-item.repository';
import { ChecklistItemsController } from './checklist-items.controller';
import { ChecklistItemsService } from './checklist-items.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChecklistItem])],
  controllers: [ChecklistItemsController],
  providers: [
    { provide: CHECKLIST_ITEM_REPOSITORY, useClass: ChecklistItemRepository },
    ChecklistItemsService,
  ],
  exports: [ChecklistItemsService],
})
export class ChecklistItemsModule {}
