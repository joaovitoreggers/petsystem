import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DeviceCredential } from './auth/entities/device-credential.entity';
import { Employee } from './employees/entities/employee.entity';
import { EmployeesModule } from './employees/employees.module';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { AccessEvent } from './qr-validation/entities/access-event.entity';
import { QrValidationModule } from './qr-validation/qr-validation.module';
import { WorkPermit } from './work-permits/entities/work-permit.entity';
import { WorkPermitsModule } from './work-permits/work-permits.module';
import { TeamMember } from './team-members/entities/team-member.entity';
import { TeamMembersModule } from './team-members/team-members.module';
import { PetAnalysisModule } from './pet-analysis/pet-analysis.module';
import { CompanyGroup } from './tenancy/entities/company-group.entity';
import { Branch } from './tenancy/entities/branch.entity';
import { TenancyModule } from './tenancy/tenancy.module';
import { Permission } from './auth/entities/permission.entity';
import { Role } from './auth/entities/role.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      /**
       * Conexao vinda do ambiente.
       *
       * `DATABASE_URL` tem prioridade — e o formato que os servicos de
       * hospedagem entregam, num valor so. As variaveis separadas cobrem o
       * desenvolvimento local.
       *
       * A senha nao tem valor padrao de proposito: um padrao embutido vira
       * credencial no codigo, e pior, uma que continua funcionando em
       * producao se alguem esquecer de definir a variavel.
       */
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        ...(configService.get<string>('DATABASE_URL')
          ? { url: configService.get<string>('DATABASE_URL') }
          : {
              host: configService.get<string>('DB_HOST', 'localhost'),
              port: Number(configService.get<string>('DB_PORT', '5432')),
              username: configService.get<string>('DB_USERNAME', 'petsystem'),
              password: configService.get<string>('DB_PASSWORD'),
              database: configService.get<string>('DB_NAME', 'petsystem'),
            }),
        entities: [
          Role,
          Permission,
          User,
          Employee,
          AccessEvent,
          WorkPermit,
          TeamMember,
          CompanyGroup,
          Branch,
          DeviceCredential,
        ],
        // Desligado: o schema agora e versionado em apps/backend/migrations,
        // aplicado por `npm run db:migrate`. synchronize compara entidade com
        // banco e aplica a diferenca sozinho — pratico no comeco, arriscado
        // com dado real, porque pode remover coluna e nao deixa historico do
        // que mudou nem como voltar atras.
        synchronize: false,
      }),
    }),
    UsersModule,
    EmployeesModule,
    AuthModule,
    QrValidationModule,
    WorkPermitsModule,
    TeamMembersModule,
    PetAnalysisModule,
    TenancyModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
