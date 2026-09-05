import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AccessResult {
  AUTHORIZED = 'AUTHORIZED',
  DENIED = 'DENIED',
  INVALID_QR = 'INVALID_QR',
  DUPLICATE = 'DUPLICATE',
}

@Entity('access_events')
export class AccessEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId!: number | null;

  @Column({ type: 'varchar' })
  result!: AccessResult;

  @Column({ name: 'qr_code_read', type: 'varchar', nullable: true })
  qrCodeRead!: string | null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;
}
