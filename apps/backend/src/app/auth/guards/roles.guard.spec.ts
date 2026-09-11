import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthenticatedUser } from '../jwt-payload.interface';

function contextWithUser(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

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

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows any authenticated user when the route has no @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser(user({})))).toBe(true);
  });

  it('allows any authenticated user when @Roles() is an empty list', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(contextWithUser(user({})))).toBe(true);
  });

  it('allows a user whose role is in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'gestor']);
    expect(guard.canActivate(contextWithUser(user({ role: 'gestor' })))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'gestor']);
    expect(() => guard.canActivate(contextWithUser(user({ role: 'tecnico' })))).toThrow(
      ForbiddenException,
    );
  });

  it('lets platform-admin bypass any @Roles() requirement, without being listed', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'gestor']);
    expect(guard.canActivate(contextWithUser(user({ role: 'platform-admin' })))).toBe(true);
  });

  it('rejects when there is no authenticated user on the request at all', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
