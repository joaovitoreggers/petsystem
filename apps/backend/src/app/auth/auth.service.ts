import { randomUUID } from 'crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyGroupsService } from '../tenancy/company-groups.service';
import { UsersService } from '../users/users.service';
import {
  IWebAuthnCredentialRepository,
  WEBAUTHN_CREDENTIAL_REPOSITORY,
} from './repositories/webauthn-credential-repository.interface';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

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

interface PendingChallenge {
  challenge: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  // Desafios de WebAuthn em memória — vivem só o tempo de uma cerimônia
  // (segundos), então não precisam sobreviver a um restart nem ser
  // compartilhados entre instâncias, igual a todo o resto deste back-end
  // (sem Redis nem sessão distribuída em lugar nenhum). Cadastro é
  // guardado por usuário (a rota já exige sessão real); login é guardado
  // por um id aleatório devolvido ao cliente, já que nesse momento ainda
  // não se sabe quem é o usuário — é exatamente esse o ponto de uma
  // credencial "discoverable".
  private readonly registrationChallenges = new Map<string, PendingChallenge>();
  private readonly authenticationChallenges = new Map<string, PendingChallenge>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly companyGroupsService: CompanyGroupsService,
    private readonly branchesService: BranchesService,
    @Inject(WEBAUTHN_CREDENTIAL_REPOSITORY)
    private readonly webAuthnCredentialRepository: IWebAuthnCredentialRepository,
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

  private get rpID(): string {
    return this.configService.get<string>('WEBAUTHN_RP_ID', 'localhost');
  }

  private get rpOrigin(): string {
    return this.configService.get<string>('WEBAUTHN_RP_ORIGIN', 'http://localhost:58080');
  }

  /**
   * Opções para o navegador chamar `navigator.credentials.create(...)` —
   * cadastra uma passkey vinculada à biometria nativa do aparelho (Face
   * ID/Touch ID/Windows Hello/impressão digital). Só chamado com uma
   * sessão real já em mãos (rota exige JwtAuthGuard).
   */
  async getRegistrationOptions(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    const existing = await this.webAuthnCredentialRepository.findByUserId(userId);
    const options = await generateRegistrationOptions({
      rpName: 'PET Digital',
      rpID: this.rpID,
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports })),
      // localDevice = pede especificamente o autenticador da plataforma
      // (biometria nativa), não uma chave de segurança externa (Yubikey
      // etc.) nem QR-code para outro aparelho — é exatamente "guardar o
      // acesso do jeito que o navegador faz" para este aparelho.
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
    });
    this.registrationChallenges.set(userId, {
      challenge: options.challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return options;
  }

  async verifyRegistration(userId: string, response: RegistrationResponseJSON): Promise<void> {
    const pending = this.registrationChallenges.get(userId);
    this.registrationChallenges.delete(userId);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new UnauthorizedException('Cadastro de biometria expirou — tente novamente');
    }
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.rpOrigin,
      expectedRPID: this.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Não foi possível confirmar a biometria');
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await this.webAuthnCredentialRepository.create({
      id: credential.id,
      userId,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports,
    });
  }

  /**
   * Opções para `navigator.credentials.get(...)` — sem `allowCredentials`
   * de propósito: como o cadastro pede `residentKey: 'required'`, é o
   * próprio autenticador da plataforma que sabe, para esta origem, qual
   * credencial oferecer — não precisa (e não dá) para o servidor saber
   * quem é o usuário antes da biometria confirmar.
   */
  async getAuthenticationOptions(): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }> {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'required',
    });
    const challengeId = randomUUID();
    this.authenticationChallenges.set(challengeId, {
      challenge: options.challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return { options, challengeId };
  }

  async loginWithBiometric(
    challengeId: string,
    response: AuthenticationResponseJSON,
  ): Promise<LoginResult> {
    const pending = this.authenticationChallenges.get(challengeId);
    this.authenticationChallenges.delete(challengeId);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new UnauthorizedException('Login por biometria expirou — tente novamente');
    }
    const credential = await this.webAuthnCredentialRepository.findById(response.id);
    if (!credential) {
      throw new UnauthorizedException('Biometria não reconhecida neste aparelho');
    }
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.rpOrigin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) {
      throw new UnauthorizedException('Biometria não reconhecida');
    }
    await this.webAuthnCredentialRepository.updateCounter(
      credential.id,
      verification.authenticationInfo.newCounter,
    );
    const user = await this.usersService.findById(credential.userId);
    if (!user) {
      throw new UnauthorizedException('Aparelho não reconhecido');
    }
    return this.login({
      id: user.id,
      email: user.email,
      role: user.role,
      companyGroupId: user.companyGroupId,
      branchId: user.branchId,
    });
  }

  async hasBiometricCredential(userId: string): Promise<boolean> {
    const credentials = await this.webAuthnCredentialRepository.findByUserId(userId);
    return credentials.length > 0;
  }

  // "Esquecer" a biometria deste aparelho — ao contrário do token de
  // aparelho antigo, uma passkey de verdade não é revogada no logout (é
  // assim que navegadores/gerenciadores de senha se comportam: sair do
  // site não apaga o Face ID salvo). Fica como ação explícita, separada.
  async forgetBiometricCredential(credentialId: string, userId: string): Promise<void> {
    const credential = await this.webAuthnCredentialRepository.findById(credentialId);
    if (credential && credential.userId === userId) {
      await this.webAuthnCredentialRepository.delete(credentialId);
    }
  }
}
