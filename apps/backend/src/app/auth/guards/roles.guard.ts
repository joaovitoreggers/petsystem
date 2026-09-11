import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../jwt-payload.interface';

/**
 * Guard pattern: exige que `request.user.role` (populado por JwtAuthGuard,
 * que deve rodar antes) esteja entre os papéis marcados com `@Roles(...)` na
 * rota. Sem `@Roles(...)`, a rota fica liberada para qualquer usuário
 * autenticado. `platform-admin` passa em qualquer `@Roles(...)`, sem
 * precisar ser listado — é o papel acima de todos os tenants.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    if (!user || (user.role !== 'platform-admin' && !requiredRoles.includes(user.role))) {
      throw new ForbiddenException('Seu papel não tem permissão para esta ação');
    }
    return true;
  }
}
