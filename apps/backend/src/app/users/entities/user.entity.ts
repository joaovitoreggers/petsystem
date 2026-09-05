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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
