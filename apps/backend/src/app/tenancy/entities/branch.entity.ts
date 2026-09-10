import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Filial/unidade dentro de um grupo de empresas (ex.: Matelândia, dentro do
 * grupo Lar Cooperativa Agroindustrial). Substitui, a nível relacional, o
 * campo texto livre `unit` usado hoje em TeamMember/WorkPermit — o texto
 * continua existindo para não quebrar o front-end atual.
 */
@Entity('branches')
export class Branch {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'company_group_id', type: 'uuid' })
  companyGroupId!: string;

  @Column()
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
