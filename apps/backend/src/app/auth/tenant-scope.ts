import { NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from './jwt-payload.interface';

/**
 * Recorte de tenant do usuário autenticado, usado pelos services
 * (Users/TeamMembers/WorkPermits/Employees) para filtrar o que cada um pode
 * ver e mexer: platform-admin não tem grupo e enxerga/mexe em tudo; um
 * `companyGroupId` sem `branchId` enxerga todas as filiais do grupo; com
 * `branchId`, só aquela filial.
 */
export interface TenantScope {
  role: string;
  companyGroupId: string | null;
  branchId: string | null;
}

export function scopeFromUser(user: AuthenticatedUser): TenantScope {
  return {
    role: user.role,
    companyGroupId: user.companyGroupId ?? null,
    branchId: user.branchId ?? null,
  };
}

export interface TenantOwnedRecord {
  companyGroupId: string | null;
  branchId: string | null;
}

/**
 * Barreira de isolamento para toda escrita em um registro específico
 * (editar/excluir/fechar/etc.) — sem ela, `findAll` filtra o que aparece
 * numa lista, mas nada impede uma sessão de outro tenant de mexer num
 * registro cujo id/matrícula ela já conheça. `NotFoundException` (não
 * Forbidden) de propósito: pra quem está fora do tenant, o registro precisa
 * parecer que nem existe, não só que é proibido — "sem se relacionar com
 * os outros tenants" vale também pra não confirmar que eles existem.
 */
export function assertOwnedByScope(
  record: TenantOwnedRecord,
  scope: TenantScope | undefined,
  notFoundMessage: string,
): void {
  if (!scope || scope.role === 'platform-admin') {
    return;
  }
  if (record.companyGroupId !== scope.companyGroupId) {
    throw new NotFoundException(notFoundMessage);
  }
  if (scope.branchId && record.branchId !== scope.branchId) {
    throw new NotFoundException(notFoundMessage);
  }
}

/**
 * Mesmo recorte de visibilidade do `assertOwnedByScope`, mas pra filtrar
 * uma lista inteira (`findAll`) em vez de barrar um registro só.
 */
export function filterOwnedByScope<T extends TenantOwnedRecord>(
  records: T[],
  scope: TenantScope | undefined,
): T[] {
  if (!scope || scope.role === 'platform-admin') {
    return records;
  }
  if (scope.branchId) {
    return records.filter((r) => r.branchId === scope.branchId);
  }
  if (!scope.companyGroupId) {
    return records;
  }
  return records.filter((r) => r.companyGroupId === scope.companyGroupId);
}
