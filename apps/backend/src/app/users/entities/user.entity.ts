import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('users')
export class User {
  // UUID gerado em código (ver UserRepository.create), não pelo banco: evita
  // depender da extensão uuid-ossp do Postgres. É esse mesmo valor que vira o
  // conteúdo do QR code do crachá — nunca muda, então qualquer edição no
  // cadastro do usuário não invalida crachás já gerados.
  @PrimaryColumn('uuid')
  id!: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
