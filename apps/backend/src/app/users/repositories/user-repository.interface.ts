import { TenantScope } from '../../auth/tenant-scope';
import { User } from '../entities/user.entity';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  companyGroupId: string | null;
  branchId: string | null;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  passwordHash?: string;
  role?: string;
  companyGroupId?: string | null;
  branchId?: string | null;
}

/**
 * Repository pattern: isolates data access for User from the ORM choice.
 * Only UsersModule may depend on this token; other modules go through UsersService.
 */
export interface IUserRepository {
  findAll(): Promise<User[]>;
  /**
   * Contas que este escopo pode ver, filtradas no proprio SQL.
   *
   * Existe separado de findAll() porque recortar depois, em memoria, e
   * carregar antes o que nao se pode ver: a lista inteira da plataforma sai
   * do banco e so entao a da outra empresa e descartada. O isolamento entre
   * industrias tem que acontecer na consulta.
   */
  findAllScoped(scope?: TenantScope): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  /** Carimba o ultimo acesso. Separado de update() porque nao e edicao de cadastro. */
  touchLastAccess(id: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
