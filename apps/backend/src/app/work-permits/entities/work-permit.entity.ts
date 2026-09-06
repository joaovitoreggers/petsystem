import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type WorkPermitStatus = 'aberta' | 'fechada' | 'ocorrencia';

export interface WorkPermitGasReading {
  o2: number;
  co: number;
  h2s: number;
  lel: number;
}

// Registro de uma liberação com ressalva: um funcionário com documentação
// (ASO/NR) vencida foi admitido na equipe mesmo assim, por decisão do
// técnico responsável, em vez de ter a entrada bloqueada.
export interface WorkPermitCriticalAlert {
  employeeName: string;
  registration: string;
  documentName: string;
  message: string;
  timestamp: string;
}

// Cada medição atmosférica pós-emissão é digitada manualmente pelo técnico
// (sem sensor conectado) e fica registrada aqui para auditoria, além de
// substituir a leitura atual em `gas`.
export interface WorkPermitReading {
  time: string;
  text: string;
}

export type WorkPermitGasKey = 'o2' | 'co' | 'h2s' | 'lel';

// Uma leitura manual fora do limite de segurança gera um registro próprio,
// distinto do log normal de medição (`readings`) — para não passar
// despercebida no histórico da PET.
export interface WorkPermitAtmosphereAlert {
  gas: WorkPermitGasKey;
  value: number;
  limitText: string;
  message: string;
  timestamp: string;
}

export type WorkPermitTeamRole = 'equipe' | 'vigia' | 'resgate';

// Quem foi liberado na PET, por papel — preenchido a partir da leitura de
// crachá na etapa "Crachá e permissão" do assistente.
export interface WorkPermitTeamMember {
  name: string;
  registration: string;
  role: string;
  petRole: WorkPermitTeamRole;
}

/**
 * PET (Permissão de Entrada e Trabalho): permissão emitida pelo técnico de
 * segurança para uma intervenção em área de risco. O id segue o formato
 * legível PET-<ano>-<sequencial> em vez de uuid, pois é exibido ao usuário
 * em toda a interface.
 */
@Entity('work_permits')
export class WorkPermit {
  @PrimaryColumn('varchar')
  id!: string;

  @Column({ type: 'jsonb' })
  areas!: string[];

  @Column()
  location!: string;

  @Column()
  unit!: string;

  @Column({ name: 'team_size' })
  teamSize!: number;

  @Column()
  date!: string;

  @Column()
  start!: string;

  @Column({ default: '' })
  end!: string;

  @Column({ name: 'time_label' })
  timeLabel!: string;

  @Column()
  technician!: string;

  @Column()
  status!: WorkPermitStatus;

  @Column({ default: '' })
  coordinates!: string;

  @Column({ type: 'jsonb', nullable: true })
  gas?: WorkPermitGasReading;

  @Column({ default: false })
  alarm!: boolean;

  @Column({ name: 'duration_minutes', nullable: true })
  durationMinutes?: number;

  @Column({ name: 'critical_alerts', type: 'jsonb', nullable: true })
  criticalAlerts?: WorkPermitCriticalAlert[];

  @Column({ name: 'company_phone', nullable: true })
  companyPhone?: string;

  @Column({ name: 'close_reason', nullable: true })
  closeReason?: string;

  @Column({ name: 'closed_by', nullable: true })
  closedBy?: string;

  @Column({ type: 'jsonb', nullable: true })
  readings?: WorkPermitReading[];

  @Column({ type: 'jsonb', nullable: true })
  team?: WorkPermitTeamMember[];

  @Column({ name: 'atmosphere_alerts', type: 'jsonb', nullable: true })
  atmosphereAlerts?: WorkPermitAtmosphereAlert[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
