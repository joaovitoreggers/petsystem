import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantScope } from '../../auth/tenant-scope';
import { User } from '../entities/user.entity';
import {
  CreateUserData,
  IUserRepository,
  UpdateUserData,
} from './user-repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  /**
   * A consulta que o cadastro de usuarios usa.
   *
   * Duas regras, as duas no SQL:
   *
   * 1. a conta de plataforma (o dono da Artech) nunca aparece — ela existe
   *    para administrar o sistema, nao e funcionaria de industria nenhuma,
   *    e listar o dono junto do pessoal da Lar so confunde quem olha;
   * 2. cada sessao ve apenas a sua industria (ou o seu grupo, quando cuida
   *    do grupo inteiro).
   */
  findAllScoped(scope?: TenantScope): Promise<User[]> {
    const qb = this.repository
      .createQueryBuilder('u')
      .where('u.role <> :plataforma', { plataforma: 'platform-admin' })
      .orderBy('u.name', 'ASC');

    if (scope && scope.role !== 'platform-admin') {
      if (scope.branchId) {
        qb.andWhere('u.branch_id = :branchId', { branchId: scope.branchId });
      } else if (scope.companyGroupId) {
        qb.andWhere('u.company_group_id = :groupId', { groupId: scope.companyGroupId });
      }
    }
    return qb.getMany();
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  create(data: CreateUserData): Promise<User> {
    const user = this.repository.create({
      id: randomUUID(),
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: data.role,
      companyGroupId: data.companyGroupId,
      branchId: data.branchId,
    });
    return this.repository.save(user);
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const user = await this.repository.findOneBy({ id });
    if (!user) {
      return null;
    }
    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    if (data.passwordHash !== undefined) user.password = data.passwordHash;
    if (data.role !== undefined) user.role = data.role;
    if (data.companyGroupId !== undefined) user.companyGroupId = data.companyGroupId;
    if (data.branchId !== undefined) user.branchId = data.branchId;
    return this.repository.save(user);
  }

  /**
   * Carimba o acesso sem carregar nem regravar o usuario inteiro.
   *
   * UPDATE direto de proposito: passar por findOneBy + save abriria janela
   * para sobrescrever com dado velho uma edicao feita entre a leitura e a
   * gravacao — e um carimbo de horario nao justifica esse risco.
   */
  async touchLastAccess(id: string): Promise<void> {
    await this.repository.update(id, { lastAccess: new Date() });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
