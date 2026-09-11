import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Grupo de empresas: o tenant de topo do sistema. Uma empresa/cooperativa
 * (ex.: Lar Cooperativa Agroindustrial) pode reunir várias filiais (Branch)
 * sob o mesmo grupo — todo usuário, funcionário e PET pertence a um grupo.
 */
@Entity('company_groups')
export class CompanyGroup {
  @PrimaryColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
