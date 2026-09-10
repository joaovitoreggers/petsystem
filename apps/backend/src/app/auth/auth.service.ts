import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyGroupsService } from '../tenancy/company-groups.service';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';

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
}
