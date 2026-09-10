import { AuthenticatedUser } from './jwt-payload.interface';

/**
 * Recorte de tenant do usuário autenticado, usado pelos services
 * (Users/TeamMembers/WorkPermits) para filtrar o que cada um pode ver:
 * platform-admin não tem grupo e enxerga tudo; um `companyGroupId` sem
 * `branchId` enxerga todas as filiais do grupo; com `branchId`, só aquela
 * filial.
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
