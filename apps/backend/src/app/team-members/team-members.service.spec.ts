import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BranchesService } from '../tenancy/branches.service';
import { TeamMember } from './entities/team-member.entity';
import { ITeamMemberRepository } from './repositories/team-member-repository.interface';
import { TeamMembersService } from './team-members.service';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function teamMember(overrides: Partial<TeamMember>): TeamMember {
  return {
    registration: '04812',
    name: 'Jonas R. Kirchner',
    role: 'Mecânico industrial',
    company: 'Lar · Manutenção',
    unit: 'Matelândia',
    companyGroupId: GROUP_ID,
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

      const result = await service.create(
        {
          registration: '04812',
          name: 'Jonas R. Kirchner',
          role: 'Mecânico industrial',
          company: 'Lar · Manutenção',
          unit: 'Matelândia',
          documents: { ASO: '2027-03-14' },
        },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(result).toBe(created);
    });

    it('rejects when no company group can be determined at all', async () => {
      repository.findByRegistration.mockResolvedValue(null);

      await expect(
        service.create({
          registration: '04812',
          name: 'Jonas R. Kirchner',
          role: 'Mecânico industrial',
          company: 'Lar · Manutenção',
          unit: 'Matelândia',
          documents: {},
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('resolves branchId by matching unit against the caller company group branches', async () => {
      repository.findByRegistration.mockResolvedValue(null);
      repository.create.mockResolvedValue(teamMember({}));
      branchesService.findByCompanyGroupAndName.mockResolvedValue({
        id: 'branch-1',
        companyGroupId: GROUP_ID,
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
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(branchesService.findByCompanyGroupAndName).toHaveBeenCalledWith(GROUP_ID, 'Matelândia');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: GROUP_ID, branchId: 'branch-1' }),
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
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: null }));
    });

    it('respects an explicit companyGroupId/branchId instead of the scope (used by the seed migration)', async () => {
      repository.findByRegistration.mockResolvedValue(null);
      repository.create.mockResolvedValue(teamMember({}));

      await service.create({
        registration: '04812',
        name: 'Jonas R. Kirchner',
        role: 'Mecânico industrial',
        company: 'Lar · Manutenção',
        unit: 'Matelândia',
        documents: {},
        companyGroupId: 'explicit-group',
        branchId: 'explicit-branch',
      });

      expect(branchesService.findByCompanyGroupAndName).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyGroupId: 'explicit-group', branchId: 'explicit-branch' }),
      );
    });
  });

  describe('update — tenant isolation', () => {
    it('rejects editing a team member from a different tenant, as if it did not exist', async () => {
      repository.findByRegistration.mockResolvedValue(
        teamMember({ companyGroupId: 'other-group' }),
      );

      await expect(
        service.update(
          '04812',
          { role: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('a branch-restricted caller cannot edit a member from a sibling branch in the same group', async () => {
      repository.findByRegistration.mockResolvedValue(
        teamMember({ companyGroupId: GROUP_ID, branchId: 'b2' }),
      );

      await expect(
        service.update(
          '04812',
          { role: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: 'b1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lets platform-admin edit a team member from any tenant', async () => {
      repository.findByRegistration.mockResolvedValue(
        teamMember({ companyGroupId: 'other-group' }),
      );
      repository.update.mockResolvedValue(teamMember({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          '04812',
          { role: 'Ok' },
          { role: 'platform-admin', companyGroupId: null, branchId: null },
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('delete — tenant isolation', () => {
    it('rejects deleting a team member from a different tenant, as if it did not exist', async () => {
      repository.findByRegistration.mockResolvedValue(
        teamMember({ companyGroupId: 'other-group' }),
      );

      await expect(
        service.delete('04812', { role: 'gestor', companyGroupId: GROUP_ID, branchId: null }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll (tenant scoping)', () => {
    it('returns every member when there is no scope', async () => {
      const members = [teamMember({ registration: '1' }), teamMember({ registration: '2' })];
      repository.findAll.mockResolvedValue(members);

      await expect(service.findAll()).resolves.toEqual(members);
    });

    it('returns every member for platform-admin, regardless of tenant', async () => {
      const members = [
        teamMember({ registration: '1', companyGroupId: GROUP_ID }),
        teamMember({ registration: '2', companyGroupId: 'other-group' }),
      ];
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

      const result = await service.findAll({ role: 'tecnico', companyGroupId: GROUP_ID, branchId: 'b1' });

      expect(result.map((m: TeamMember) => m.registration)).toEqual(['1']);
    });

    it('restricts a group-wide caller to members of their own company group, regardless of branch', async () => {
      const members = [
        teamMember({ registration: '1', companyGroupId: GROUP_ID, branchId: 'b1' }),
        teamMember({ registration: '2', companyGroupId: GROUP_ID, branchId: null }),
        teamMember({ registration: '3', companyGroupId: 'other-group', branchId: null }),
      ];
      repository.findAll.mockResolvedValue(members);

      const result = await service.findAll({ role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(result.map((m: TeamMember) => m.registration)).toEqual(['1', '2']);
    });
  });
});
