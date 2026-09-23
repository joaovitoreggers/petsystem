import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Local físico cadastrado pela empresa (tela "Locais"), já com a área de
 * risco que se aplica a ele por padrão. Permite ao técnico escolher um
 * local já conhecido no assistente "Nova PET" e ter a área de risco, o
 * nome e a unidade preenchidos sozinhos, em vez de digitar tudo de novo a
 * cada PET.
 */
@Entity('company_locations')
export class CompanyLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // Códigos de RiskAreaId do front-end (ver pet-mock-data.ts) — mais de um
  // quando o local combina riscos (ex.: espaço confinado + altura).
  @Column({ name: 'risk_areas', type: 'jsonb', default: [] })
  riskAreas!: string[];

  @Column()
  unit!: string;

  // Mesmo padrão de isolamento entre tenants de TeamMember: toda criação
  // exige um grupo (ver CompanyLocationsService.create); `branchId` é a
  // filial relacional correspondente a `unit`, resolvida por nome dentro
  // desse grupo.
  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
