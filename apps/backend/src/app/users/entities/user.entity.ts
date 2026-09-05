import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column()
  role!: string;

  @Column({ name: 'access_level', type: 'int' })
  accessLevel!: number;

  @Index({ unique: true })
  @Column({ name: 'qr_code' })
  qrCode!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
