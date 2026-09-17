import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessControlService } from './access-control.service';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Autorizacao, separada da autenticacao.
 *
 * Existe como modulo proprio para que um recurso (Funcionarios, Portas,
 * Tarefas…) possa proteger suas rotas por permissao importando so isto, sem
 * arrastar junto o AuthModule inteiro — que carrega Passport, JWT, login e
 * credencial de dispositivo. Menos acoplamento e, principalmente, sem risco
 * de dependencia circular quando o proprio AuthModule precisar checar
 * permissao.
 *
 * Autenticar responde "quem e voce"; autorizar responde "voce pode isto".
 * São perguntas diferentes, e agora vivem em lugares diferentes.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  providers: [AccessControlService, PermissionsGuard],
  exports: [AccessControlService, PermissionsGuard],
})
export class AccessControlModule {}
