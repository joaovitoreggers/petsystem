import { ConflictException } from '@nestjs/common';
import { BranchesService } from '../tenancy/branches.service';
import { TeamMember } from './entities/team-member.entity';
import { ITeamMemberRepository } from './repositories/team-member-repository.interface';
import { TeamMembersService } from './team-members.service';

function teamMember(overrides: Partial<TeamMember>): TeamMember {
  return {
    registration: '04812',
    name: 'Jonas R. Kirchner',
    role: 'Mecânico industrial',
    company: 'Lar · Manutenção',
    unit: 'Matelândia',
    branchId: null,
    isThirdParty: false,
    documents: { ASO: '2027-03-14' },
    createdAt: new Date(),
    ...overrides,
  };
}

describe('TeamMembersService', () => {
  let service: TeamMembersService;
  let repository: jest.Mocked<ITeamMemberRepository>;
  let branchesService: jest.Mocked<BranchesService>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findByRegistration: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    branchesService = {
      findByCompanyGroupAndName: jest.fn().mockResolvedValue(null),
      findByCompanyGroup: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<BranchesService>;
    service = new TeamMembersService(repository, branchesService);
  });

  describe('create', () => {
    it('throws ConflictException when the registration already exists', async () => {
      repository.findByRegistration.mockResolvedValue(teamMember({}));

      await expect(
        service.create({
          registration: '04812',
          name: 'Outro Nome',
          role: 'Mecânico',
          company: 'Lar',
          unit: 'Matelândia',
          documents: {},
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates the team member when the registration is free', async () => {
      repository.findByRegistration.mockResolvedValue(null);
      const created = teamMember({});
      repository.create.mockResolvedValue(created);

      const result = await service.create({
        registration: '04812',
        name: 'Jonas R. Kirchner',
        role: 'Mecânico industrial',
        company: 'Lar · Manutenção',
        unit: 'Matelândia',
        documents: { ASO: '2027-03-14' },
      });

      expect(result).toBe(created);
    });

    it('resolves branchId by matching unit against the caller company group branches', async () => {
      repository.findByRegistration.mockResolvedValue(null);
      repository.create.mockResolvedValue(teamMember({}));
      branchesService.findByCompanyGroupAndName.mockResolvedValue({
        id: 'branch-1',
        companyGroupId: 'group-1',
        name: 'Matelândia',
        createdAt: new Date(),
      });

      await service.create(
        {
          registration: '04812',
          name: 'Jonas R. Kirchner',
          role: 'Mecânico industrial',
          company: 'Lar · Manutenção',
          unit: 'Matelândia',
          documents: {},
        },
        { role: 'gestor', companyGroupId: 'group-1', branchId: null },
      );

      expect(branchesService.findByCompanyGroupAndName).toHaveBeenCalledWith('group-1', 'Matelândia');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-1' }),
      );
    });

    it('leaves branchId null when no branch in the group matches the unit name', async () => {
      repository.findByRegistration.mockResolvedValue(null);
      repository.create.mockResolvedValue(teamMember({}));
      branchesService.findByCompanyGroupAndName.mockResolvedValue(null);

      await service.create(
        {
          registration: '04812',
          name: 'Jonas R. Kirchner',
          role: 'Mecânico industrial',
          company: 'Lar · Manutenção',
          unit: 'Unidade Inexistente',
          documents: {},
        },
        { role: 'gestor', companyGroupId: 'group-1', branchId: null },
      );

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
    });

    it('never resolves a branch when the caller has no scope at all (unauthenticated path)', async () => {
      repository.findByRegistration.mockResolvedValue(null);
      repository.create.mockResolvedValue(teamMember({}));

      await service.create({
        registration: '04812',
        name: 'Jonas R. Kirchner',
        role: 'Mecânico industrial',
        company: 'Lar · Manutenção',
        unit: 'Matelândia',
        documents: {},
      });

      expect(branchesService.findByCompanyGroupAndName).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
    });

    it('respects an explicitly-provided branchId instead of overriding it with the auto-resolved one', async () => {
      repository.findByRegistration.mockResolvedValue(null);
      repository.create.mockResolvedValue(teamMember({}));

      await service.create(
        {
          registration: '04812',
          name: 'Jonas R. Kirchner',
          role: 'Mecânico industrial',
          company: 'Lar · Manutenção',
          unit: 'Matelândia',
          documents: {},
          branchId: 'explicit-branch',
        },
        { role: 'gestor', companyGroupId: 'group-1', branchId: null },
      );

      expect(branchesService.findByCompanyGroupAndName).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'explicit-branch' }),
      );
    });
  });

  describe('findAll (tenant scoping)', () => {
    it('returns every member when there is no scope', async () => {
      const members = [teamMember({ registration: '1' }), teamMember({ registration: '2' })];
      repository.findAll.mockResolvedValue(members);

      await expect(service.findAll()).resolves.toEqual(members);
    });

    it('returns every member for platform-admin, regardless of branch', async () => {
      const members = [teamMember({ registration: '1', branchId: 'b1' })];
      repository.findAll.mockResolvedValue(members);

      await expect(
        service.findAll({ role: 'platform-admin', companyGroupId: null, branchId: null }),
      ).resolves.toEqual(members);
    });

    it('restricts a branch-scoped caller to only their own branch', async () => {
      const members = [
        teamMember({ registration: '1', branchId: 'b1' }),
        teamMember({ registration: '2', branchId: 'b2' }),
      ];
      repository.findAll.mockResolvedValue(members);

      const result = await service.findAll({ role: 'tecnico', companyGroupId: 'g1', branchId: 'b1' });

      expect(result.map((m: TeamMember) => m.registration)).toEqual(['1']);
    });

    it('restricts a group-wide caller to members of branches within their own group', async () => {
      const members = [
        teamMember({ registration: '1', branchId: 'b1' }), // in-group
        teamMember({ registration: '2', branchId: 'b-other-group' }), // different group
        teamMember({ registration: '3', branchId: null }), // no branch at all — excluded
      ];
      repository.findAll.mockResolvedValue(members);
      branchesService.findByCompanyGroup.mockResolvedValue([
        { id: 'b1', companyGroupId: 'g1', name: 'Matelândia', createdAt: new Date() },
      ]);

      const result = await service.findAll({ role: 'gestor', companyGroupId: 'g1', branchId: null });

      expect(result.map((m: TeamMember) => m.registration)).toEqual(['1']);
      expect(branchesService.findByCompanyGroup).toHaveBeenCalledWith('g1');
    });
  });
});
