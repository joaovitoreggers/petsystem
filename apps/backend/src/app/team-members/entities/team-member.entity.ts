import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Funcionário cadastrado no registro de trabalhadores autorizados do SESMT
 * (tela "Funcionários" do PET Digital). A matrícula já é a chave natural do
 * mundo real, então é usada como chave primária em vez de um uuid.
 */
@Entity('team_members')
export class TeamMember {
  @PrimaryColumn('varchar')
  registration!: string;

  @Column()
  name!: string;

  @Column()
  role!: string;

  @Column()
  company!: string;

  @Column()
  unit!: string;

  // Dono de verdade do registro para isolamento entre tenants: toda
  // criação exige um grupo (ver TeamMembersService.create) — nulo só em
  // registros órfãos de antes da multi-tenancy que o seed ainda não
  // conseguiu casar com nenhum grupo. `branchId` é a filial relacional
  // correspondente a `unit`, resolvida por nome dentro desse grupo — o
  // texto livre `unit` continua sendo a fonte exibida no front-end nesta
  // fase, os dois campos abaixo são só para o back-end.
  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @Column({ name: 'is_third_party', default: false })
  isThirdParty!: boolean;

  @Column({ type: 'jsonb', default: {} })
  documents!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
