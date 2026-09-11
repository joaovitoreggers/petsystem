import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { User } from '../users/entities/user.entity';
import { WorkPermit } from '../work-permits/entities/work-permit.entity';
import { Branch } from './entities/branch.entity';

/**
 * Checa se um grupo/filial ainda tem algo vinculado, pra bloquear a
 * exclusão em vez de deixar órfãos (companyGroupId/branchId apontando pra
 * algo que não existe mais). Registra as entidades das outras camadas
 * direto aqui (`TypeOrmModule.forFeature` de novo, mesma tabela) em vez de
 * importar UsersModule/TeamMembersModule/WorkPermitsModule/EmployeesModule
 * — evitaria um ciclo, já que esses módulos importam TenancyModule.
 */
@Injectable()
export class TenancyReferenceGuardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TeamMember) private readonly teamMembers: Repository<TeamMember>,
    @InjectRepository(WorkPermit) private readonly workPermits: Repository<WorkPermit>,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
  ) {}

  async companyGroupHasReferences(companyGroupId: string): Promise<boolean> {
    const counts = await Promise.all([
      this.branches.count({ where: { companyGroupId } }),
      this.users.count({ where: { companyGroupId } }),
      this.teamMembers.count({ where: { companyGroupId } }),
      this.workPermits.count({ where: { companyGroupId } }),
      this.employees.count({ where: { companyGroupId } }),
    ]);
    return counts.some((count) => count > 0);
  }

  async branchHasReferences(branchId: string): Promise<boolean> {
    const counts = await Promise.all([
      this.users.count({ where: { branchId } }),
      this.teamMembers.count({ where: { branchId } }),
      this.workPermits.count({ where: { branchId } }),
      this.employees.count({ where: { branchId } }),
    ]);
    return counts.some((count) => count > 0);
  }
}
