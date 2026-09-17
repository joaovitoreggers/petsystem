import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from '../access-control.service';
import { AuthenticatedUser } from '../jwt-payload.interface';
import { PermissionsGuard } from './permissions.guard';

/**
 * Este guard e a barreira que de fato impede uma acao — esconder o botao na
 * tela nao impede ninguem que saiba o endereco da API. Por isso os testes
 * cobrem principalmente o que NAO pode passar: o caminho liberado falha
 * barulhento, o furo falha em silencio.
 */
function contextWith(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function usuario(id = 'u1'): AuthenticatedUser {
  return {
    id,
    email: 'alguem@petsystem.local',
    role: 'gestor',
    companyGroupId: null,
    branchId: null,
  } as AuthenticatedUser;
}

describe('PermissionsGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let accessControl: jest.Mocked<AccessControlService>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    accessControl = {
      hasAll: jest.fn(),
    } as unknown as jest.Mocked<AccessControlService>;
    guard = new PermissionsGuard(reflector, accessControl);
  });

  it('libera rota sem @RequirePermissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextWith(usuario()))).resolves.toBe(true);
    // Nao chega a consultar o banco: rota sem exigencia nao tem o que checar.
    expect(accessControl.hasAll).not.toHaveBeenCalled();
  });

  it('libera quando o usuario tem a permissao', async () => {
    reflector.getAllAndOverride.mockReturnValue(['editar_funcionario']);
    accessControl.hasAll.mockResolvedValue(true);

    await expect(guard.canActivate(contextWith(usuario()))).resolves.toBe(true);
    expect(accessControl.hasAll).toHaveBeenCalledWith('u1', ['editar_funcionario']);
  });

  it('recusa quando falta a permissao', async () => {
    reflector.getAllAndOverride.mockReturnValue(['desativar_funcionario']);
    accessControl.hasAll.mockResolvedValue(false);

    await expect(guard.canActivate(contextWith(usuario()))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('recusa sem sessao, mesmo que a rota exija permissao que exista', async () => {
    reflector.getAllAndOverride.mockReturnValue(['visualizar_portas']);

    await expect(guard.canActivate(contextWith(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(accessControl.hasAll).not.toHaveBeenCalled();
  });

  it('exige todas as permissoes da rota, nao qualquer uma', async () => {
    // Uma rota que pede duas permissoes toca duas coisas distintas; liberar
    // com metade seria liberar metade da acao.
    reflector.getAllAndOverride.mockReturnValue([
      'editar_funcionario',
      'gerenciar_permissoes',
    ]);
    accessControl.hasAll.mockResolvedValue(false);

    await expect(guard.canActivate(contextWith(usuario()))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(accessControl.hasAll).toHaveBeenCalledWith('u1', [
      'editar_funcionario',
      'gerenciar_permissoes',
    ]);
  });
});
