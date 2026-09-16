import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { WebAuthnCredential } from './auth/entities/webauthn-credential.entity';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME', 'petsystem'),
        password: configService.get<string>('DB_PASSWORD', 'petsystem'),
        database: configService.get<string>('DB_NAME', 'petsystem'),
        entities: [
          User,
          Employee,
          AccessEvent,
          WorkPermit,
          TeamMember,
          CompanyGroup,
          Branch,
          WebAuthnCredential,
        ],
        synchronize: true,
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
