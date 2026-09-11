import { of, throwError } from 'rxjs';
import { PetStateService } from './pet-state.service';
import { AuthenticatedUser, LoginResult } from './services/auth-api.service';

function authenticatedUser(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'u1',
    email: 'user@petsystem.local',
    role: 'tecnico',
    companyGroupId: null,
    branchId: null,
    ...overrides,
  };
}

// PetStateService é instanciado direto (sem TestBed): o construtor só
// injeta serviços via parâmetros normais e não chama `effect()`/`inject()`,
// então dublês simples bastam — mesmo padrão de teste unitário usado no
// back-end (`new Service(mockDep)`), sem a máquina pesada do Angular DI.
function createState(loginResult: LoginResult) {
  const workPermitsApi = { findAll: jest.fn(() => throwError(() => new Error('unauthenticated'))) };
  const teamMembersApi = { findAll: jest.fn(() => throwError(() => new Error('unauthenticated'))) };
  const authApi = { login: jest.fn(() => of(loginResult)) };
  const authToken = { setToken: jest.fn(), getToken: jest.fn() };

  const state = new PetStateService(
    workPermitsApi as never,
    teamMembersApi as never,
    authApi as never,
    authToken as never,
  );
  return { state, authApi, authToken };
}

describe('PetStateService — multi-tenancy session gating', () => {
  it('canManageTeam and isPlatformAdmin are both false before any login', () => {
    const { state } = createState({
      accessToken: 't',
      user: authenticatedUser({ role: 'tecnico' }),
    });

    expect(state.canManageTeam()).toBe(false);
    expect(state.isPlatformAdmin()).toBe(false);
  });

  it.each(['admin', 'gestor', 'platform-admin'])(
    'canManageTeam is true for a %s session',
    async (role) => {
      const { state } = createState({
        accessToken: 't',
        user: authenticatedUser({ role }),
      });
      state.setLoginEmail(`${role}@petsystem.local`);
      state.setLoginPassword('senha123');

      await state.loginWithPassword();

      expect(state.canManageTeam()).toBe(true);
    },
  );

  it('canManageTeam is false for a plain tecnico session', async () => {
    const { state } = createState({
      accessToken: 't',
      user: authenticatedUser({ role: 'tecnico' }),
    });
    state.setLoginEmail('tecnico@petsystem.local');
    state.setLoginPassword('senha123');

    await state.loginWithPassword();

    expect(state.canManageTeam()).toBe(false);
    expect(state.isPlatformAdmin()).toBe(false);
  });

  it('isPlatformAdmin is true only for a platform-admin session', async () => {
    const { state } = createState({
      accessToken: 't',
      user: authenticatedUser({ role: 'platform-admin', companyGroupId: null }),
    });
    state.setLoginEmail('platform-admin@petsystem.local');
    state.setLoginPassword('senha123');

    await state.loginWithPassword();

    expect(state.isPlatformAdmin()).toBe(true);
    expect(state.canManageTeam()).toBe(true);
  });

  it('isPlatformAdmin is false for an admin session (has a company group)', async () => {
    const { state } = createState({
      accessToken: 't',
      user: authenticatedUser({ role: 'admin', companyGroupId: 'group-1' }),
    });
    state.setLoginEmail('admin@petsystem.local');
    state.setLoginPassword('senha123');

    await state.loginWithPassword();

    expect(state.isPlatformAdmin()).toBe(false);
    expect(state.canManageTeam()).toBe(true);
  });

  it('stores the JWT in AuthTokenService on login and clears it on logout', async () => {
    const { state, authToken } = createState({
      accessToken: 'the-jwt',
      user: authenticatedUser({ role: 'gestor', companyGroupId: 'group-1' }),
    });
    state.setLoginEmail('gestor@petsystem.local');
    state.setLoginPassword('senha123');

    await state.loginWithPassword();
    expect(authToken.setToken).toHaveBeenCalledWith('the-jwt');

    state.logout();
    expect(authToken.setToken).toHaveBeenCalledWith(null);
    expect(state.canManageTeam()).toBe(false);
    expect(state.isPlatformAdmin()).toBe(false);
  });
});
