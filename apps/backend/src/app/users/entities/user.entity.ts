import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Usuario: conta de login do sistema (porteiro/operador) — não confundir com
 * Employee (funcionário de campo, validado no QrValidationModule). Um
 * usuário não é necessariamente também um funcionário, e vice-versa.
 */
@Entity('users')
export class User {
  // UUID gerado em código (ver UserRepository.create), não pelo banco: evita
  // depender da extensão uuid-ossp do Postgres.
  @PrimaryColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column()
  role!: string;

  // Tenant do usuário. Nulo só para platform-admin (papel acima de todos os
  // grupos); obrigatório para os demais papéis. `branchId` nulo significa
  // "enxerga todas as filiais do grupo"; preenchido restringe a uma só.
  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  /**
   * Ultima vez que esta conta entrou no sistema.
   *
   * Gravado no login (ver AuthService.login). Nulo significa "nunca entrou"
   * — o que e informacao, nao ausencia de dado: conta criada e nunca usada e
   * exatamente o que o gestor precisa enxergar.
   */
  @Column({ name: 'last_access', type: 'timestamptz', nullable: true })
  lastAccess!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
