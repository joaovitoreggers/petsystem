import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Permissao: uma acao que o sistema sabe autorizar, independente de cargo.
 *
 * Separar permissao de cargo e o que permite responder "quem pode desativar
 * funcionario?" sem varrer o codigo, e mudar essa resposta sem publicar uma
 * versao nova — basta alterar o vinculo em role_permissions.
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Ex.: 'editar_funcionario'. E o texto usado no guard e nas telas. */
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column()
  name!: string;

  /** Agrupa a lista na tela de administracao (portas, tarefas, admin…). */
  @Column({ default: 'geral' })
  category!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
