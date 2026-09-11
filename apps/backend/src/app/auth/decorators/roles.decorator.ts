import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Marca uma rota com os papéis (`User.role`) autorizados a chamá-la. Só tem
 * efeito combinado com `JwtAuthGuard` (que popula `request.user`) e
 * `RolesGuard` (que lê esse metadado e compara).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
