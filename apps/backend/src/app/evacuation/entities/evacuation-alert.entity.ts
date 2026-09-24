import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Um acionamento de evacuação. O `id` é gerado como uuid v4 de propósito:
 * ele também é o token da página pública de status (ver EvacuationService.
 * getPublicStatus) — precisa ser não-adivinhável, diferente do id legível
 * da PET (PET-<ano>-<sequencial>), que um estranho poderia enumerar.
 */
@Entity('evacuation_alerts')
export class EvacuationAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Nula quando a evacuação foi acionada sem uma PET específica em foco
  // (retirada geral das frentes ativas) — ver PetStateService.evacuationPet.
  // Tipo explícito ('varchar', igual ao WorkPermit.id que referencia): um
  // union com `null` não vira metadata de tipo utilizável por reflexão no
  // build via SWC — sem isso o TypeORM tenta gravar a coluna como "Object"
  // e o Postgres recusa (mesmo motivo do comentário em WorkPermit.status).
  @Column({ name: 'work_permit_id', type: 'varchar', nullable: true })
  workPermitId!: string | null;

  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @CreateDateColumn({ name: 'triggered_at' })
  triggeredAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;
}
