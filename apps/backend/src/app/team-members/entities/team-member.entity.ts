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

  @Column({ name: 'is_third_party', default: false })
  isThirdParty!: boolean;

  @Column({ type: 'jsonb', default: {} })
  documents!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
