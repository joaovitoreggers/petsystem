import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Cargo: o agrupamento de permissoes que se atribui a uma pessoa.
 *
 * A tabela existe (ver migration 002_rbac.sql) para que criar um cargo novo
 * seja cadastro, e nao alteracao de codigo. Ate aqui o papel era um texto na
 * coluna users.role, conferido comparando strings: funciona com quatro
 * cargos fixos e vira um emaranhado de `if` no dia em que alguem precisa de
 * um quinto.
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Chave estavel usada no codigo; o nome e so exibicao. */
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Cargo de sistema nao e apagavel pela tela: sem ADMINISTRADOR ninguem
   * consegue voltar a administrar o sistema.
   */
  @Column({ name: 'is_system', default: false })
  isSystem!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
