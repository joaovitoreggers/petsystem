import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from '../access-control.service';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../jwt-payload.interface';

/**
 * Barreira de autorizacao do servidor.
 *
 * Esconder um botao na tela nao e controle de acesso: quem souber o endereco
 * da API faz a chamada direto do terminal. Este guard e o que de fato
 * impede — roda depois do JwtAuthGuard, que coloca o usuario autenticado na
 * requisicao, e consulta as permissoes no banco a cada chamada.
 *
 * Rota sem @RequirePermissions passa: a decisao de proteger e explicita, e
 * exigir permissao por padrao quebraria silenciosamente todas as rotas que
 * ainda nao foram migradas para o modelo novo. O que nao pode acontecer e o
 * contrario — uma rota marcada que deixa passar.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControl: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Sessao necessaria para esta acao.');
    }

    const autorizado = await this.accessControl.hasAll(user.id, required);
    if (!autorizado) {
      // A mensagem diz o que faltou sem revelar quem tem a alcada: e o que a
      // pessoa na tela precisa para saber que deve procurar outra pessoa.
      throw new ForbiddenException(
        'Seu cargo nao tem permissao para esta acao.',
      );
    }
    return true;
  }
}
