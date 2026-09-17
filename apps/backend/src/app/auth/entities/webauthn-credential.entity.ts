import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Uma passkey registrada — "lembrar este aparelho" via biometria nativa
 * (Face ID/Touch ID/Windows Hello/impressão digital), no lugar do
 * reconhecimento facial simulado em JS que existia antes. O id é o
 * credential ID que o autenticador da plataforma gera (base64url), e a
 * chave pública é o que permite ao servidor verificar a assinatura de cada
 * login sem nunca ver nem guardar o segredo em si — esse nunca sai do
 * hardware seguro do aparelho.
 */
@Entity('webauthn_credentials')
export class WebAuthnCredential {
  @PrimaryColumn('varchar')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'public_key', type: 'bytea' })
  publicKey!: Buffer;

  // Contador anti-clonagem: cada assinatura deve vir com um contador maior
  // que o anterior. Se um dia vier menor ou igual, é sinal de credencial
  // clonada — ver verifyAuthenticationResponse() do @simplewebauthn/server.
  @Column({ type: 'bigint' })
  counter!: number;

  @Column({ name: 'device_type', type: 'varchar' })
  deviceType!: 'singleDevice' | 'multiDevice';

  @Column({ name: 'backed_up' })
  backedUp!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  transports?: string[];

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
