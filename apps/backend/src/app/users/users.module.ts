import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessControlModule } from '../auth/access-control.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { User } from './entities/user.entity';
import { USER_REPOSITORY } from './repositories/user-repository.interface';
import { UserRepository } from './repositories/user.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // TenancyModule entra para o cadastro conferir a que grupo uma
  // industria pertence antes de lotar alguem nela. Nao forma ciclo:
  // TenancyModule registra a entidade User, mas nunca importa UsersModule.
  imports: [TypeOrmModule.forFeature([User]), TenancyModule, AccessControlModule],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserRepository },
    UsersService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
