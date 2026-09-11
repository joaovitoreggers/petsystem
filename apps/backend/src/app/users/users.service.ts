import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
import { User } from './entities/user.entity';
import {
  IUserRepository,
  USER_REPOSITORY,
} from './repositories/user-repository.interface';

const SALT_ROUNDS = 10;
const NOT_FOUND_MESSAGE = 'Usuário não encontrado';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: string;
  companyGroupId?: string;
  branchId?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  companyGroupId?: string;
  branchId?: string | null;
}

/**
 * Público boundary de UsersModule. Other modules (Auth, QrValidation) depend
 * only on this service, never on IUserRepository directly.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async findAll(scope?: TenantScope): Promise<User[]> {
    const users = await this.userRepository.findAll();
    return filterOwnedByScope(users, scope);
  }

  async findById(id: string, scope?: TenantScope): Promise<User | null> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return null;
    }
    assertOwnedByScope(user, scope, NOT_FOUND_MESSAGE);
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  // `scope` é quem está cadastrando (via API) — usado só para preencher
  // companyGroupId por padrão quando o DTO não o informa (um admin/gestor
  // cadastra dentro do próprio grupo sem precisar escolher). Ausente no
  // seed, que sempre informa o grupo explicitamente.
  async create(data: CreateUserInput, scope?: TenantScope): Promise<User> {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Este email já está em uso');
    }

    const { companyGroupId, branchId } = resolveTenancy(data.role, data.companyGroupId, data.branchId, scope);

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return this.userRepository.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      companyGroupId,
      branchId,
    });
  }

  async update(id: string, data: UpdateUserInput, scope?: TenantScope): Promise<User> {
    const current = await this.userRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    if (data.email !== undefined) {
      const existing = await this.userRepository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Este email já está em uso');
      }
    }

    const nextRole = data.role ?? current.role;
    const { companyGroupId, branchId } = resolveTenancy(
      nextRole,
      data.companyGroupId ?? current.companyGroupId ?? undefined,
      data.branchId !== undefined ? data.branchId : current.branchId ?? undefined,
      scope,
    );

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, SALT_ROUNDS)
      : undefined;

    const updated = await this.userRepository.update(id, {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      companyGroupId,
      branchId,
    });

    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  async delete(id: string, scope?: TenantScope): Promise<void> {
    const current = await this.userRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }

  validatePassword(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, passwordHash);
  }
}

// platform-admin nunca tem grupo/filial; qualquer outro papel precisa de um
// grupo — do DTO, ou (padrão) o do próprio admin/gestor que está
// cadastrando/editando. Um admin/gestor não-platform-admin nunca pode
// escolher um `companyGroupId` diferente do próprio — isso moveria o
// usuário pra outro tenant, exatamente a relação entre tenants que este
// sistema não permite; só platform-admin pode apontar pra um grupo
// qualquer (é o único papel sem um grupo "próprio" pra comparar).
function resolveTenancy(
  role: string,
  requestedCompanyGroupId: string | undefined,
  requestedBranchId: string | null | undefined,
  scope: TenantScope | undefined,
): { companyGroupId: string | null; branchId: string | null } {
  if (role === 'platform-admin') {
    return { companyGroupId: null, branchId: null };
  }

  if (
    scope &&
    scope.role !== 'platform-admin' &&
    requestedCompanyGroupId !== undefined &&
    requestedCompanyGroupId !== scope.companyGroupId
  ) {
    throw new BadRequestException(
      'Você não pode atribuir um usuário a outro grupo de empresas',
    );
  }

  const companyGroupId = requestedCompanyGroupId ?? scope?.companyGroupId ?? null;
  if (!companyGroupId) {
    throw new BadRequestException(
      'Informe o grupo de empresas para este usuário',
    );
  }
  return { companyGroupId, branchId: requestedBranchId ?? null };
}
