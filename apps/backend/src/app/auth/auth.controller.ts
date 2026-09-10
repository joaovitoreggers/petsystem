import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService, LoginResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { DeviceLoginDto } from './dto/device-login.dto';
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

  // Emitido só com uma sessão real já em mãos (JwtAuthGuard) — o passo de
  // "habilitar reconhecimento facial neste aparelho" chama isto logo após
  // um POST /auth/login bem-sucedido por e-mail/senha.
  @Post('device-token')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async issueDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ deviceToken: string }> {
    const deviceToken = await this.authService.issueDeviceToken(user.id);
    return { deviceToken };
  }

  // Trocado pelo reconhecimento facial no front-end depois que a câmera
  // casa o rosto capturado com o descritor guardado localmente — o token
  // sozinho não é a senha, mas devolve uma sessão de verdade (mesmo
  // formato de POST /auth/login).
  @Post('device-login')
  @HttpCode(HttpStatus.OK)
  deviceLogin(@Body() dto: DeviceLoginDto): Promise<LoginResult> {
    return this.authService.loginWithDeviceToken(dto.deviceToken);
  }

  // Chamado no logout — invalida o aparelho lembrado, não só limpa o
  // token local (ver AuthService.revokeDeviceToken).
  @Delete('device-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async revokeDeviceToken(
    @Body() dto: DeviceLoginDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.authService.revokeDeviceToken(dto.deviceToken, user.id);
  }
}
