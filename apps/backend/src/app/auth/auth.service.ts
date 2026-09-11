import { randomBytes, randomUUID } from 'crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyGroupsService } from '../tenancy/company-groups.service';
import { UsersService } from '../users/users.service';
import {
  DEVICE_CREDENTIAL_REPOSITORY,
  IDeviceCredentialRepository,
} from './repositories/device-credential-repository.interface';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';

const SALT_ROUNDS = 10;

export interface LoginResult {
  accessToken: string;
  // Nomes só existem aqui, na resposta de login — nunca no JWT nem em
  // AuthenticatedUser (o formato usado em toda requisição autenticada,
  // reconstruído do payload do token). Embutir no token faria o nome
  // exibido ficar desatualizado se o grupo/filial fosse renomeado depois
  // sem precisar logar de novo, e resolver de novo a cada requisição
  // custaria uma consulta a mais em toda rota protegida — só vale a pena
  // pagar esse custo uma vez, no login.
  user: AuthenticatedUser & { companyGroupName: string | null; branchName: string | null };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly companyGroupsService: CompanyGroupsService,
    private readonly branchesService: BranchesService,
    @Inject(DEVICE_CREDENTIAL_REPOSITORY)
    private readonly deviceCredentialRepository: IDeviceCredentialRepository,
  ) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }
    const passwordValid = await this.usersService.validatePassword(
      password,
      user.password,
    );
    if (!passwordValid) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyGroupId: user.companyGroupId,
      branchId: user.branchId,
    };
  }

  async login(user: AuthenticatedUser): Promise<LoginResult> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyGroupId: user.companyGroupId,
      branchId: user.branchId,
    };

    const [companyGroup, branch] = await Promise.all([
      user.companyGroupId ? this.companyGroupsService.findById(user.companyGroupId) : null,
      user.branchId ? this.branchesService.findById(user.branchId) : null,
    ]);

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        ...user,
        companyGroupName: companyGroup?.name ?? null,
        branchName: branch?.name ?? null,
      },
    };
  }

  /**
   * "Lembrar este aparelho" — emitido só enquanto o usuário já está
   * autenticado de verdade (rota exige JwtAuthGuard), depois que o
   * reconhecimento facial no front-end casou o rosto capturado com o
   * descritor guardado localmente. O token devolvido (`id.segredo`) nunca
   * é a senha; só ele + o rosto reconhecido localmente reabrem uma sessão
   * — perder um sozinho, sem o outro, não abre nada.
   */
  async issueDeviceToken(userId: string): Promise<string> {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const secretHash = await bcrypt.hash(secret, SALT_ROUNDS);
    await this.deviceCredentialRepository.create({ id, userId, secretHash });
    return `${id}.${secret}`;
  }

  async loginWithDeviceToken(deviceToken: string): Promise<LoginResult> {
    const credential = await this.resolveDeviceCredential(deviceToken);
    const user = await this.usersService.findById(credential.userId);
    if (!user) {
      throw new UnauthorizedException('Aparelho não reconhecido');
    }
    await this.deviceCredentialRepository.touchLastUsed(credential.id);
    return this.login({
      id: user.id,
      email: user.email,
      role: user.role,
      companyGroupId: user.companyGroupId,
      branchId: user.branchId,
    });
  }

  // Chamado no logout — "lembrada até a pessoa clicar em Sair" significa
  // que sair precisa mesmo invalidar o aparelho, não só limpar o token
  // local: sem isso, alguém com o descritor de rosto e o token guardados
  // (ex. copiados do localStorage) continuaria conseguindo entrar depois.
  async revokeDeviceToken(deviceToken: string, userId: string): Promise<void> {
    const [id] = deviceToken.split('.');
    if (!id) return;
    const credential = await this.deviceCredentialRepository.findById(id);
    if (credential && credential.userId === userId) {
      await this.deviceCredentialRepository.delete(id);
    }
  }

  private async resolveDeviceCredential(deviceToken: string) {
    const [id, secret] = deviceToken.split('.');
    if (!id || !secret) {
      throw new UnauthorizedException('Aparelho não reconhecido');
    }
    const credential = await this.deviceCredentialRepository.findById(id);
    if (!credential) {
      throw new UnauthorizedException('Aparelho não reconhecido');
    }
    const valid = await bcrypt.compare(secret, credential.secretHash);
    if (!valid) {
      throw new UnauthorizedException('Aparelho não reconhecido');
    }
    return credential;
  }
}
