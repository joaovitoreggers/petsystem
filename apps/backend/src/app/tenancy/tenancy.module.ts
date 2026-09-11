import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [TypeOrmModule.forFeature([CompanyGroup, Branch])],
  controllers: [CompanyGroupsController, BranchesController],
  providers: [
    { provide: COMPANY_GROUP_REPOSITORY, useClass: CompanyGroupRepository },
    { provide: BRANCH_REPOSITORY, useClass: BranchRepository },
    CompanyGroupsService,
    BranchesService,
  ],
  exports: [CompanyGroupsService, BranchesService],
})
export class TenancyModule {}
