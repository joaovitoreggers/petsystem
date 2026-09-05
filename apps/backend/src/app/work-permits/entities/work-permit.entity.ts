import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type WorkPermitStatus = 'aberta' | 'fechada' | 'ocorrencia';

export interface WorkPermitGasReading {
  o2: number;
  co: number;
  h2s: number;
  lel: number;
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
