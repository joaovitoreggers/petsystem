import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { User } from '../users/entities/user.entity';
import { WorkPermit } from '../work-permits/entities/work-permit.entity';
import { Branch } from './entities/branch.entity';
import { TenancyReferenceGuardService } from './tenancy-reference-guard.service';

function repoWithCount(count: number) {
  return { count: jest.fn().mockResolvedValue(count) };
}

describe('TenancyReferenceGuardService', () => {
  function build(counts: { users?: number; teamMembers?: number; workPermits?: number; employees?: number; branches?: number }) {
    const users = repoWithCount(counts.users ?? 0);
    const teamMembers = repoWithCount(counts.teamMembers ?? 0);
    const workPermits = repoWithCount(counts.workPermits ?? 0);
    const employees = repoWithCount(counts.employees ?? 0);
    const branches = repoWithCount(counts.branches ?? 0);
    const service = new TenancyReferenceGuardService(
      users as unknown as Repository<User>,
      teamMembers as unknown as Repository<TeamMember>,
      workPermits as unknown as Repository<WorkPermit>,
      employees as unknown as Repository<Employee>,
      branches as unknown as Repository<Branch>,
    );
    return { service, users, teamMembers, workPermits, employees, branches };
  }

  describe('companyGroupHasReferences', () => {
    it('is false when nothing references the group', async () => {
      const { service } = build({});
      await expect(service.companyGroupHasReferences('g1')).resolves.toBe(false);
    });

    it('is true when the group still has a branch', async () => {
      const { service, branches } = build({ branches: 1 });
      await expect(service.companyGroupHasReferences('g1')).resolves.toBe(true);
      expect(branches.count).toHaveBeenCalledWith({ where: { companyGroupId: 'g1' } });
    });

    it('is true when the group still has a user, even with zero branches', async () => {
      const { service } = build({ users: 1 });
      await expect(service.companyGroupHasReferences('g1')).resolves.toBe(true);
    });

    it('is true when the group still has a team member, work permit, or employee', async () => {
      await expect(build({ teamMembers: 1 }).service.companyGroupHasReferences('g1')).resolves.toBe(true);
      await expect(build({ workPermits: 1 }).service.companyGroupHasReferences('g1')).resolves.toBe(true);
      await expect(build({ employees: 1 }).service.companyGroupHasReferences('g1')).resolves.toBe(true);
    });
  });

  describe('branchHasReferences', () => {
    it('is false when nothing references the branch', async () => {
      const { service } = build({});
      await expect(service.branchHasReferences('b1')).resolves.toBe(false);
    });

    it('is true when the branch still has a user', async () => {
      const { service, users } = build({ users: 1 });
      await expect(service.branchHasReferences('b1')).resolves.toBe(true);
      expect(users.count).toHaveBeenCalledWith({ where: { branchId: 'b1' } });
    });

    it('is true when the branch still has a team member, work permit, or employee', async () => {
      await expect(build({ teamMembers: 1 }).service.branchHasReferences('b1')).resolves.toBe(true);
      await expect(build({ workPermits: 1 }).service.branchHasReferences('b1')).resolves.toBe(true);
      await expect(build({ employees: 1 }).service.branchHasReferences('b1')).resolves.toBe(true);
    });
  });
});
