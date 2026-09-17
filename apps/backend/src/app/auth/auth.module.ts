import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../tenancy/tenancy.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessControlModule } from './access-control.module';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { WEBAUTHN_CREDENTIAL_REPOSITORY } from './repositories/webauthn-credential-repository.interface';
import { WebAuthnCredentialRepository } from './repositories/webauthn-credential.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    UsersModule,
    TenancyModule,
    PassportModule,
    TypeOrmModule.forFeature([WebAuthnCredential]),
    AccessControlModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '8h'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    { provide: WEBAUTHN_CREDENTIAL_REPOSITORY, useClass: WebAuthnCredentialRepository },
  ],
  // Exportados para qualquer modulo poder proteger rota por permissao sem
  // reconstruir a consulta de cargos.
  exports: [AuthService, AccessControlModule],
})
export class AuthModule {}
