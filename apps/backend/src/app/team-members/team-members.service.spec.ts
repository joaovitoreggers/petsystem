import { ConflictException } from '@nestjs/common';
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
    isThirdParty: false,
    documents: { ASO: '2027-03-14' },
    createdAt: new Date(),
    ...overrides,
  };
}

describe('TeamMembersService', () => {
  let service: TeamMembersService;
  let repository: jest.Mocked<ITeamMemberRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findByRegistration: jest.fn(),
      create: jest.fn(),
    };
    service = new TeamMembersService(repository);
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
  });
});
