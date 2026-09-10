import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

function branch(overrides: Partial<{ id: string; companyGroupId: string; name: string }>) {
  return { id: 'b1', companyGroupId: 'g1', name: 'Matelândia', createdAt: new Date(), ...overrides };
}

describe('BranchesController', () => {
  let controller: BranchesController;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findByCompanyGroup' | 'create' | 'getByIdOrFail' | 'update' | 'delete'>
  >;
  let companyGroupsService: jest.Mocked<Pick<CompanyGroupsService, 'getByIdOrFail'>>;

  beforeEach(() => {
    branchesService = {
      findByCompanyGroup: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      getByIdOrFail: jest.fn().mockResolvedValue(branch({})),
      update: jest.fn(),
      delete: jest.fn(),
    };
    companyGroupsService = {
      getByIdOrFail: jest.fn().mockResolvedValue({ id: 'g1', name: 'Lar', createdAt: new Date() }),
    };
    controller = new BranchesController(
      branchesService as unknown as BranchesService,
      companyGroupsService as unknown as CompanyGroupsService,
    );
  });

  describe('findAll (read access — any authenticated tenant member)', () => {
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

    it('allows the gestor of the same group', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'gestor', companyGroupId: 'g1' })),
      ).resolves.toEqual([]);
    });

    it('allows a plain tecnico of the same group — reading the branch list is not privileged', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'tecnico', companyGroupId: 'g1' })),
      ).resolves.toEqual([]);
    });

    it('rejects an admin of a different group', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'admin', companyGroupId: 'g2' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a session with no company group at all', async () => {
      await expect(
        controller.findAll('g1', user({ role: 'gestor', companyGroupId: null })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create (write access)', () => {
    it('allows platform-admin', async () => {
      branchesService.create.mockResolvedValue(branch({}));

      await expect(
        controller.create('g1', { name: 'Nova' }, user({ role: 'platform-admin', companyGroupId: null })),
      ).resolves.toMatchObject({ id: 'b1' });
    });

    it('allows the admin of the same group', async () => {
      branchesService.create.mockResolvedValue(branch({}));

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

  describe('update (rename)', () => {
    it('allows the admin of the same group', async () => {
      branchesService.update.mockResolvedValue(branch({ name: 'Renomeada' }));

      await expect(
        controller.update('g1', 'b1', { name: 'Renomeada' }, user({ role: 'admin', companyGroupId: 'g1' })),
      ).resolves.toMatchObject({ name: 'Renomeada' });
    });

    it('rejects the gestor of the same group', async () => {
      await expect(
        controller.update('g1', 'b1', { name: 'Renomeada' }, user({ role: 'gestor', companyGroupId: 'g1' })),
      ).rejects.toThrow(ForbiddenException);
      expect(branchesService.update).not.toHaveBeenCalled();
    });

    it('rejects when the branch belongs to a different group than the one in the URL', async () => {
      branchesService.getByIdOrFail.mockResolvedValue(branch({ companyGroupId: 'g2' }));

      await expect(
        controller.update('g1', 'b1', { name: 'Renomeada' }, user({ role: 'admin', companyGroupId: 'g1' })),
      ).rejects.toThrow(NotFoundException);
      expect(branchesService.update).not.toHaveBeenCalled();
    });
  });

  describe('remove (delete)', () => {
    it('allows the admin of the same group', async () => {
      await controller.remove('g1', 'b1', user({ role: 'admin', companyGroupId: 'g1' }));

      expect(branchesService.delete).toHaveBeenCalledWith('b1');
    });

    it('rejects the gestor of the same group', async () => {
      await expect(
        controller.remove('g1', 'b1', user({ role: 'gestor', companyGroupId: 'g1' })),
      ).rejects.toThrow(ForbiddenException);
      expect(branchesService.delete).not.toHaveBeenCalled();
    });

    it('rejects when the branch belongs to a different group than the one in the URL', async () => {
      branchesService.getByIdOrFail.mockResolvedValue(branch({ companyGroupId: 'g2' }));

      await expect(
        controller.remove('g1', 'b1', user({ role: 'admin', companyGroupId: 'g1' })),
      ).rejects.toThrow(NotFoundException);
      expect(branchesService.delete).not.toHaveBeenCalled();
    });
  });
});
