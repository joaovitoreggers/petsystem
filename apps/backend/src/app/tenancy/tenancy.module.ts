import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { User } from '../users/entities/user.entity';
import { WorkPermit } from '../work-permits/entities/work-permit.entity';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { CompanyGroupsController } from './company-groups.controller';
import { CompanyGroupsService } from './company-groups.service';
import { Branch } from './entities/branch.entity';
import { CompanyGroup } from './entities/company-group.entity';
import { BRANCH_REPOSITORY } from './repositories/branch-repository.interface';
import { BranchRepository } from './repositories/branch.repository';
import { COMPANY_GROUP_REPOSITORY } from './repositories/company-group-repository.interface';
import { CompanyGroupRepository } from './repositories/company-group.repository';
import { TenancyReferenceGuardService } from './tenancy-reference-guard.service';

@Module({
  // User/TeamMember/WorkPermit/Employee entrando aqui de novo (mesma
  // tabela que os módulos deles próprios registram) é só pro
  // TenancyReferenceGuardService checar vínculos antes de excluir um
  // grupo/filial — ver o comentário lá. Não cria um ciclo porque esses
  // módulos é que importam TenancyModule, nunca o contrário.
  imports: [TypeOrmModule.forFeature([CompanyGroup, Branch, User, TeamMember, WorkPermit, Employee])],
  controllers: [CompanyGroupsController, BranchesController],
  providers: [
    { provide: COMPANY_GROUP_REPOSITORY, useClass: CompanyGroupRepository },
    { provide: BRANCH_REPOSITORY, useClass: BranchRepository },
    CompanyGroupsService,
    BranchesService,
    TenancyReferenceGuardService,
  ],
  exports: [CompanyGroupsService, BranchesService],
})
export class TenancyModule {}
