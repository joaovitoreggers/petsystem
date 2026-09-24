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

  // Usado para enviar o código de confirmação por SMS/WhatsApp na
  // assinatura eletrônica de PET (emitente) — opcional até ser cadastrado.
  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  // Tenant do usuário. Nulo só para platform-admin (papel acima de todos os
  // grupos); obrigatório para os demais papéis. `branchId` nulo significa
  // "enxerga todas as filiais do grupo"; preenchido restringe a uma só.
  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
