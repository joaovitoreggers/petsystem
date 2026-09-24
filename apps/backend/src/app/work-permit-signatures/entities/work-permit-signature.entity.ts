import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export const SIGNATURE_PET_ROLES = ['emitente', 'executante', 'encerrante'] as const;
export type SignaturePetRole = (typeof SIGNATURE_PET_ROLES)[number];

export const SIGNATURE_LIFECYCLE_EVENTS = ['abertura', 'encerramento'] as const;
export type SignatureLifecycleEvent = (typeof SIGNATURE_LIFECYCLE_EVENTS)[number];

export type SignerType = 'user' | 'team_member';

export type SignatureMethod = 'biometria' | 'cracha_pin' | 'sms_otp';

export interface SignatureGeolocation {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Uma assinatura eletrônica ("avançada", Lei 14.063/2020) de um evento do
 * ciclo de vida da PET (abertura/encerramento) por um papel específico
 * (emitente/executante/encerrante). `signerType` diz qual dos dois espaços
 * de identidade desconectados do sistema assinou — `User` (login, sempre o
 * emitente) ou `TeamMember` (escala da PET, chave é a matrícula) — só a
 * coluna correspondente é preenchida por linha.
 *
 * `contentHash`/`contentSnapshot` são o que prova o que foi assinado: o
 * back-end recalcula o hash a partir do conteúdo recebido e exige que bata
 * com o que está aqui antes de aceitar a assinatura como válida para aquele
 * evento (ver WorkPermitsService.create/close) — nunca confia num hash vindo
 * do cliente.
 */
@Entity('work_permit_signatures')
export class WorkPermitSignature {
  @PrimaryColumn('uuid')
  id!: string;

  // Nulo até a PET ser criada de fato (assinaturas de abertura acontecem
  // antes de existir um id de PET — ver draftId) ou sempre nulo pra uma
  // assinatura de encerramento que nunca chegou a ser vinculada.
  @Column({ name: 'work_permit_id', type: 'varchar', nullable: true })
  workPermitId!: string | null;

  // Id gerado pelo front-end ao entrar no passo de assinatura do assistente
  // "Nova PET", antes de existir uma PET — é o que amarra as assinaturas de
  // abertura umas às outras e, depois, à PET recém-criada.
  @Column({ name: 'draft_id', type: 'varchar', nullable: true })
  draftId!: string | null;

  @Column({ name: 'pet_role', type: 'varchar' })
  petRole!: SignaturePetRole;

  @Column({ name: 'lifecycle_event', type: 'varchar' })
  lifecycleEvent!: SignatureLifecycleEvent;

  @Column({ name: 'signer_type', type: 'varchar' })
  signerType!: SignerType;

  @Column({ name: 'signer_user_id', type: 'uuid', nullable: true })
  signerUserId!: string | null;

  @Column({ name: 'signer_team_member_registration', type: 'varchar', nullable: true })
  signerTeamMemberRegistration!: string | null;

  // Nome exibível capturado no momento da assinatura — não recalculado a
  // partir do cadastro atual, pra um histórico de assinatura não mudar se a
  // pessoa for renomeada depois.
  @Column({ name: 'signer_name', type: 'varchar' })
  signerName!: string;

  @Column({ type: 'varchar' })
  method!: SignatureMethod;

  @Column({ name: 'content_hash', type: 'varchar' })
  contentHash!: string;

  @Column({ name: 'content_snapshot', type: 'jsonb' })
  contentSnapshot!: Record<string, unknown>;

  @Column({ name: 'webauthn_credential_id', type: 'varchar', nullable: true })
  webauthnCredentialId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  geolocation!: SignatureGeolocation | null;

  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @CreateDateColumn({ name: 'signed_at' })
  signedAt!: Date;
}
