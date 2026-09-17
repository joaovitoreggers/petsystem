import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { UsersService } from '../users/users.service';
import { AccessControlService } from './access-control.service';
import { AuthService, LoginResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { VerifyWebAuthnLoginDto } from './dto/verify-webauthn-login.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthenticatedUser } from './jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accessControl: AccessControlService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Quem sou eu e o que posso fazer.
   *
   * Rota propria, e nao um campo a mais na resposta do login, porque a
   * pergunta se repete: depois de um login por biometria, ao reabrir o app com
   * token guardado, e sempre que alguem mexe nos cargos. Uma permissao
   * gravada so no momento do login envelheceria junto com o token.
   *
   * O que volta daqui serve a interface — para nao oferecer um botao que a
   * API vai recusar. Quem decide de fato continua sendo o PermissionsGuard,
   * no servidor.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const [permissions, roles, conta] = await Promise.all([
      this.accessControl.permissionsOf(user.id),
      this.accessControl.rolesOf(user.id),
      this.usersService.findById(user.id),
    ]);
    return {
      // O nome acompanha porque esta rota e a que o app consulta ao reabrir
      // com o token guardado — sem ele, a tela voltaria a nao saber quem
      // esta ali.
      user: { ...user, name: conta?.name ?? user.email },
      permissions: [...permissions],
      roles,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  login(
    @Body() _loginDto: LoginDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LoginResult> {
    return this.authService.login(user);
  }

  // Cadastro da passkey — só com uma sessão real já em mãos (JwtAuthGuard):
  // "habilitar biometria neste aparelho" chama isto logo após um
  // POST /auth/login bem-sucedido por e-mail/senha.
  @Post('webauthn/register/options')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  getRegistrationOptions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return this.authService.getRegistrationOptions(user.id);
  }

  @Post('webauthn/register/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async verifyRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() response: RegistrationResponseJSON,
  ): Promise<void> {
    await this.authService.verifyRegistration(user.id, response);
  }

  // Rotas públicas: é assim que o login por biometria acontece antes de
  // existir qualquer sessão — a credencial "discoverable" é quem diz ao
  // navegador qual passkey oferecer, sem o servidor saber quem é o
  // usuário de antemão.
  @Post('webauthn/login/options')
  @HttpCode(HttpStatus.OK)
  getAuthenticationOptions(): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }> {
    return this.authService.getAuthenticationOptions();
  }

  @Post('webauthn/login/verify')
  @HttpCode(HttpStatus.OK)
  loginWithBiometric(@Body() dto: VerifyWebAuthnLoginDto): Promise<LoginResult> {
    return this.authService.loginWithBiometric(dto.challengeId, dto.response);
  }

  // "Esquecer" a biometria deste aparelho — ação explícita (ver
  // AuthService.forgetBiometricCredential): diferente do token de
  // aparelho antigo, não roda sozinha no logout.
  @Delete('webauthn/credentials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async forgetBiometric(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.authService.forgetBiometricCredential(id, user.id);
  }
}
