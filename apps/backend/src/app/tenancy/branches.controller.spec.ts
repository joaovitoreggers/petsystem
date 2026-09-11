import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { CompanyGroupsService } from './company-groups.service';

function user(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'u1',
    email: 'user@petsystem.local',
    role: 'tecnico',
    companyGroupId: null,
    branchId: null,
    ...overrides,
  };
}

describe('BranchesController', () => {
  let controller: BranchesController;
  let branchesService: jest.Mocked<Pick<BranchesService, 'findByCompanyGroup' | 'create'>>;
  let companyGroupsService: jest.Mocked<Pick<CompanyGroupsService, 'getByIdOrFail'>>;

  beforeEach(() => {
    branchesService = {
      findByCompanyGroup: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    };
    companyGroupsService = {
      getByIdOrFail: jest.fn().mockResolvedValue({ id: 'g1', name: 'Lar', createdAt: new Date() }),
    };
    controller = new BranchesController(
      branchesService as unknown as BranchesService,
      companyGroupsService as unknown as CompanyGroupsService,
    );
  });

  describe('findAll (read access)', () => {
    it('allows platform-admin regardless of their own group', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'platform-admin', companyGroupId: null })),
      ).resolves.toEqual([]);
    });

    it('allows the admin of the same group', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'admin', companyGroupId: 'g1' })),
      ).resolves.toEqual([]);
    });

    it('allows the gestor of the same group (read-only, unlike write access)', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'gestor', companyGroupId: 'g1' })),
      ).resolves.toEqual([]);
    });

    it('rejects an admin of a different group', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'admin', companyGroupId: 'g2' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a gestor with no company group at all', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'gestor', companyGroupId: null })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a plain tecnico even inside the group', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'tecnico', companyGroupId: 'g1' })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create (write access)', () => {
    it('allows platform-admin', async () => {
      branchesService.create.mockResolvedValue({
        id: 'b1',
        companyGroupId: 'g1',
        name: 'Nova',
        createdAt: new Date(),
      });

      await expect(
        controller.create('g1', { name: 'Nova' }, user({ role: 'platform-admin', companyGroupId: null })),
      ).resolves.toMatchObject({ id: 'b1' });
    });

    it('allows the admin of the same group', async () => {
      branchesService.create.mockResolvedValue({
        id: 'b1',
        companyGroupId: 'g1',
        name: 'Nova',
        createdAt: new Date(),
      });

      await expect(
        controller.create('g1', { name: 'Nova' }, user({ role: 'admin', companyGroupId: 'g1' })),
      ).resolves.toMatchObject({ id: 'b1' });
    });

    it('rejects the gestor of the same group — creating a branch needs admin, not just read access', async () => {
      await expect(
        controller.create('g1', { name: 'Nova' }, user({ role: 'gestor', companyGroupId: 'g1' })),
      ).rejects.toThrow(ForbiddenException);
      expect(branchesService.create).not.toHaveBeenCalled();
    });

    it('rejects an admin of a different group', async () => {
      await expect(
        controller.create('g1', { name: 'Nova' }, user({ role: 'admin', companyGroupId: 'g2' })),
      ).rejects.toThrow(ForbiddenException);
      expect(branchesService.create).not.toHaveBeenCalled();
    });
  });
});
