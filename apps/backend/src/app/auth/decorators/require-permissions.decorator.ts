import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'app.permissions';

/**
 * Declara o que a rota exige, em permissao e nao em cargo:
 *
 *   @RequirePermissions('editar_funcionario')
 *
 * Marcar a rota pelo que ela faz, e nao por quem costuma fazer, e o que
 * permite criar um cargo novo sem tocar em nenhum controller. Varias
 * permissoes numa chamada sao exigidas todas juntas — ver
 * AccessControlService.hasAll.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
