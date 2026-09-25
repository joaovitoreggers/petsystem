import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Item de checklist cadastrado pela própria empresa para uma área de risco
 * (NR) — o que soma aos itens fixos de CHECKLISTS no front-end (ver
 * buildChecklistGroups em pet-mock-data.ts), sem exigir alteração de
 * código. `riskAreaId` guarda o id de área do front-end (ex. 'confinado'),
 * não o número da norma — mesma convenção do RiskAreaId lá.
 */
@Entity('checklist_items')
export class ChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Tipo explícito ('varchar'): mesmo motivo do comentário em
  // WorkPermit.status — SWC não resolve metadata de tipo por reflexão pra
  // um union de string literais, e o TypeORM tentaria criar a coluna como
  // "Object".
  @Column({ name: 'risk_area_id', type: 'varchar' })
  riskAreaId!: string;

  @Column()
  label!: string;

  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
