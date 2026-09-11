import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Credencial de "lembrar este aparelho" — o que o reconhecimento facial no
 * front-end troca por um JWT de verdade depois que a câmera casa o rosto
 * com o descritor guardado localmente (ver DeviceAuthService no
 * front-end). Nunca é a senha: um segredo opaco de vida longa, só emitido
 * enquanto o usuário já está autenticado de verdade (POST /auth/login) e
 * revogado no logout — dura só até lá, por decisão explícita do usuário.
 */
@Entity('device_credentials')
export class DeviceCredential {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // bcrypt, igual à senha — nunca guardamos o segredo em texto puro.
  @Column({ name: 'secret_hash' })
  secretHash!: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
