import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Membro da brigada de emergência: quem recebe SMS/WhatsApp quando uma
 * evacuação é acionada. Cadastro separado do de Funcionários de propósito —
 * é uma lista pequena e fechada de quem responde a emergência, não o
 * quadro inteiro de pessoal (ver EvacuationModule).
 */
@Entity('emergency_contacts')
export class EmergencyContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // Formato E.164 (+5545999999999) — é o que a API do Twilio exige tanto
  // para SMS quanto para WhatsApp.
  @Column()
  phone!: string;

  @Column({ name: 'company_group_id', type: 'uuid', nullable: true })
  companyGroupId!: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
