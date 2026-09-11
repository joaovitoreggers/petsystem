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

  // Filial relacional correspondente a `unit`, resolvida por nome dentro do
  // grupo de quem cadastrou. `unit` (texto livre) continua sendo a fonte
  // exibida no front-end nesta fase — este campo é só para isolamento por
  // tenant no back-end.
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @Column({ name: 'is_third_party', default: false })
  isThirdParty!: boolean;

  @Column({ type: 'jsonb', default: {} })
  documents!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
