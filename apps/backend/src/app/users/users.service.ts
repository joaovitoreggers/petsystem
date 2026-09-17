import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccessControlService } from '../auth/access-control.service';
import { BranchesService } from '../tenancy/branches.service';
import { assertOwnedByScope, TenantScope } from '../auth/tenant-scope';
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
    // Entra so para conferir a que grupo uma industria pertence antes de
    // lotar alguem nela — ver resolveTenancy.
    private readonly branchesService: BranchesService,
    private readonly accessControl: AccessControlService,
  ) {}

  /**
   * Registra que a conta acabou de entrar.
   *
   * Melhor esforco: se o carimbo falhar, quem esta entrando entra do mesmo
   * jeito. Bloquear um login porque a coluna de "ultimo acesso" nao gravou
   * seria deixar o porteiro na portaria por causa de um detalhe de relatorio.
   */
  async registrarAcesso(id: string): Promise<void> {
    await this.userRepository.touchLastAccess(id);
  }

  /**
   * O cadastro de usuarios de quem esta pedindo.
   *
   * O recorte por industria e a omissao da conta de plataforma acontecem no
   * SQL (ver UserRepository.findAllScoped), nao aqui.
   */
  findAll(scope?: TenantScope): Promise<User[]> {
    return this.userRepository.findAllScoped(scope);
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

    const { companyGroupId, branchId } = await this.resolveTenancy(
      data.role,
      data.companyGroupId,
      data.branchId,
      scope,
    );

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const criado = await this.userRepository.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      companyGroupId,
      branchId,
    });

    // Sem isto a conta nasce sem cargo — e sem cargo nao ha permissao
    // nenhuma, entao a pessoa entra num sistema onde nada aparece e nada
    // funciona. O papel escolhido no cadastro tem que virar cargo de fato.
    await this.accessControl.sincronizarCargo(criado.id, criado.role);
    return criado;
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
    const { companyGroupId, branchId } = await this.resolveTenancy(
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

    // Mudou de papel, muda de cargo junto: um gestor rebaixado a porteiro
    // que continuasse com as permissoes de gestor teria sido rebaixado so
    // no rotulo.
    if (data.role !== undefined && data.role !== current.role) {
      await this.accessControl.sincronizarCargo(updated.id, updated.role);
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

  /**
   * Onde a conta vai morar: grupo e industria.
   *
   * Nada aqui aceita o que o cliente mandou sem conferir. Sao tres portas:
   *
   * - o grupo tem que ser o de quem esta cadastrando (so a conta de
   *   plataforma escapa disso);
   * - a industria tem que pertencer a esse grupo — sem esta checagem, um
   *   gestor da Lar poderia lotar alguem numa industria da outra empresa so
   *   trocando um id no corpo do pedido, e a conta apareceria la;
   * - quem e lotado numa industria so cadastra na propria: o campo enviado
   *   e ignorado de proposito, como acontece no resto do sistema.
   */
  private async resolveTenancy(
    role: string,
    requestedCompanyGroupId: string | undefined,
    requestedBranchId: string | null | undefined,
    scope: TenantScope | undefined,
  ): Promise<{ companyGroupId: string | null; branchId: string | null }> {
    // A conta de plataforma (dona do sistema) nao pertence a empresa
    // nenhuma — e por isso que ela nao aparece em cadastro de industria.
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
      throw new BadRequestException('Informe o grupo de empresas para este usuário');
    }

    // Sessão presa a uma indústria cadastra nela e só nela.
    if (scope?.branchId) {
      return { companyGroupId, branchId: scope.branchId };
    }

    const branchId = requestedBranchId ?? null;
    if (branchId) {
      const branch = await this.branchesService.findById(branchId);
      if (!branch || branch.companyGroupId !== companyGroupId) {
        throw new BadRequestException('Indústria inválida para este grupo de empresas');
      }
    }
    return { companyGroupId, branchId };
  }
}
