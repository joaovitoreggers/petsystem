import {
  Body,
  Controller,
  Delete,
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
import { AuthService, LoginResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { VerifyWebAuthnLoginDto } from './dto/verify-webauthn-login.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthenticatedUser } from './jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
