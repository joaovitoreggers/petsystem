import { JwtService } from '@nestjs/jwt';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyGroupsService } from '../tenancy/company-groups.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './jwt-payload.interface';

function user(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'u1',
    email: 'user@petsystem.local',
    role: 'gestor',
    companyGroupId: 'g1',
    branchId: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let companyGroupsService: jest.Mocked<Pick<CompanyGroupsService, 'findById'>>;
  let branchesService: jest.Mocked<Pick<BranchesService, 'findById'>>;

  beforeEach(() => {
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    companyGroupsService = { findById: jest.fn() };
    branchesService = { findById: jest.fn() };
    service = new AuthService(
      {} as UsersService,
      jwtService as unknown as JwtService,
      companyGroupsService as unknown as CompanyGroupsService,
      branchesService as unknown as BranchesService,
    );
  });

  describe('login', () => {
    it('resolves the company group name for a group-wide session (no branch)', async () => {
      companyGroupsService.findById.mockResolvedValue({
        id: 'g1',
        name: 'Lar Cooperativa Agroindustrial',
        createdAt: new Date(),
      });

      const result = await service.login(user({ companyGroupId: 'g1', branchId: null }));

      expect(result.user.companyGroupName).toBe('Lar Cooperativa Agroindustrial');
      expect(result.user.branchName).toBeNull();
      expect(branchesService.findById).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-jwt');
    });

    it('resolves both the company group and branch name for a branch-restricted session', async () => {
      companyGroupsService.findById.mockResolvedValue({
        id: 'g1',
        name: 'Lar Cooperativa Agroindustrial',
        createdAt: new Date(),
      });
      branchesService.findById.mockResolvedValue({
        id: 'b1',
        companyGroupId: 'g1',
        name: 'Matelândia',
        createdAt: new Date(),
      });

      const result = await service.login(user({ companyGroupId: 'g1', branchId: 'b1' }));

      expect(result.user.companyGroupName).toBe('Lar Cooperativa Agroindustrial');
      expect(result.user.branchName).toBe('Matelândia');
    });

    it('resolves both names to null for platform-admin (no group of their own)', async () => {
      const result = await service.login(
        user({ role: 'platform-admin', companyGroupId: null, branchId: null }),
      );

      expect(result.user.companyGroupName).toBeNull();
      expect(result.user.branchName).toBeNull();
      expect(companyGroupsService.findById).not.toHaveBeenCalled();
    });

    it('signs a JWT payload carrying only ids, never the resolved names', async () => {
      companyGroupsService.findById.mockResolvedValue({
        id: 'g1',
        name: 'Lar Cooperativa Agroindustrial',
        createdAt: new Date(),
      });

      await service.login(user({ companyGroupId: 'g1', branchId: null }));

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.not.objectContaining({ companyGroupName: expect.anything() }),
      );
    });
  });
});
