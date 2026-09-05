import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';

export interface LoginResult {
  accessToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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
      accessLevel: user.accessLevel,
    };
  }

  login(user: AuthenticatedUser): LoginResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accessLevel: user.accessLevel,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }
}
