import { of, throwError } from 'rxjs';
import { PetStateService } from './pet-state.service';
import { LoginResult } from './services/auth-api.service';
import { FaceEnrollment } from './services/device-auth.service';

function authenticatedUser(overrides: Partial<LoginResult['user']>): LoginResult['user'] {
  return {
    id: 'u1',
    email: 'user@petsystem.local',
    role: 'tecnico',
    companyGroupId: null,
    branchId: null,
    companyGroupName: null,
    branchName: null,
    ...overrides,
  };
}

function enrollment(overrides: Partial<FaceEnrollment> = {}): FaceEnrollment {
  return {
    descriptor: new Array(128).fill(0.1),
    deviceToken: 'cred-1.secret',
    userLabel: 'user@petsystem.local',
    ...overrides,
  };
}

// PetStateService é instanciado direto (sem TestBed): o construtor só
// injeta serviços via parâmetros normais e não chama `effect()`/`inject()`,
// então dublês simples bastam — mesmo padrão de teste unitário usado no
// back-end (`new Service(mockDep)`), sem a máquina pesada do Angular DI.
function createState(
  loginResult: LoginResult,
  options: { existingEnrollment?: FaceEnrollment | null } = {},
) {
  const workPermitsApi = { findAll: jest.fn(() => throwError(() => new Error('unauthenticated'))) };
  const teamMembersApi = { findAll: jest.fn(() => throwError(() => new Error('unauthenticated'))) };
  const authApi = {
    login: jest.fn(() => of(loginResult)),
    issueDeviceToken: jest.fn(() => of({ deviceToken: 'cred-1.secret' })),
    deviceLogin: jest.fn(() => of(loginResult)),
    revokeDeviceToken: jest.fn(() => of(undefined)),
  };
  const authToken = { setToken: jest.fn(), getToken: jest.fn() };
  const deviceAuth = {
    get: jest.fn(() => options.existingEnrollment ?? null),
    save: jest.fn(),
    clear: jest.fn(),
  };
  const faceRecognition = {
    captureDescriptor: jest.fn(async () => new Float32Array(128).fill(0.1)),
    isMatch: jest.fn(() => true),
  };

  const state = new PetStateService(
    workPermitsApi as never,
    teamMembersApi as never,
    authApi as never,
    authToken as never,
    deviceAuth as never,
    faceRecognition as never,
  );
  return { state, authApi, authToken, deviceAuth, faceRecognition };
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

  describe('tenantLabel', () => {
    it('is null before any login', () => {
      const { state } = createState({ accessToken: 't', user: authenticatedUser({}) });
      expect(state.tenantLabel()).toBeNull();
    });

    it('is just the group name for a group-wide session (no branch)', async () => {
      const { state } = createState({
        accessToken: 't',
        user: authenticatedUser({
          role: 'gestor',
          companyGroupId: 'group-1',
          companyGroupName: 'Lar Cooperativa Agroindustrial',
          branchName: null,
        }),
      });
      state.setLoginEmail('gestor@petsystem.local');
      state.setLoginPassword('senha123');

      await state.loginWithPassword();

      expect(state.tenantLabel()).toBe('Lar Cooperativa Agroindustrial');
    });

    it('is "group · branch" for a branch-restricted session', async () => {
      const { state } = createState({
        accessToken: 't',
        user: authenticatedUser({
          role: 'tecnico',
          companyGroupId: 'group-1',
          branchId: 'branch-1',
          companyGroupName: 'Lar Cooperativa Agroindustrial',
          branchName: 'Matelândia',
        }),
      });
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');

      await state.loginWithPassword();

      expect(state.tenantLabel()).toBe('Lar Cooperativa Agroindustrial · Matelândia');
    });

    it('is null for platform-admin (no group of their own)', async () => {
      const { state } = createState({
        accessToken: 't',
        user: authenticatedUser({
          role: 'platform-admin',
          companyGroupId: null,
          companyGroupName: null,
        }),
      });
      state.setLoginEmail('platform-admin@petsystem.local');
      state.setLoginPassword('senha123');

      await state.loginWithPassword();

      expect(state.tenantLabel()).toBeNull();
    });

    it('goes back to null on logout', async () => {
      const { state } = createState({
        accessToken: 't',
        user: authenticatedUser({
          role: 'gestor',
          companyGroupId: 'group-1',
          companyGroupName: 'Lar Cooperativa Agroindustrial',
        }),
      });
      state.setLoginEmail('gestor@petsystem.local');
      state.setLoginPassword('senha123');
      await state.loginWithPassword();
      expect(state.tenantLabel()).not.toBeNull();

      state.logout();

      expect(state.tenantLabel()).toBeNull();
    });
  });
});

describe('PetStateService — reconhecimento facial (facilita acesso de quem já tem conta)', () => {
  it('has no face enrollment on a fresh device', () => {
    const { state } = createState({ accessToken: 't', user: authenticatedUser({}) });

    expect(state.hasFaceEnrollment()).toBe(false);
    expect(state.authMethod()).toBe('senha');
  });

  it('loads an existing enrollment from this device on startup', () => {
    const existing = enrollment();
    const { state } = createState({ accessToken: 't', user: authenticatedUser({}) }, {
      existingEnrollment: existing,
    });

    expect(state.hasFaceEnrollment()).toBe(true);
    expect(state.authMethod()).toBe('facial');
  });

  describe('startFacialRecognition', () => {
    it('refuses to start when nothing is enrolled on this device', async () => {
      const { state, faceRecognition } = createState({ accessToken: 't', user: authenticatedUser({}) });

      await state.startFacialRecognition(document.createElement('video'));

      expect(state.faceAuthError()).toContain('Nenhum rosto cadastrado');
      expect(faceRecognition.captureDescriptor).not.toHaveBeenCalled();
    });

    it('fails clearly when no video element is available', async () => {
      const { state } = createState({ accessToken: 't', user: authenticatedUser({}) }, {
        existingEnrollment: enrollment(),
      });

      await state.startFacialRecognition(null);

      expect(state.faceAuthError()).toContain('Câmera indisponível');
    });

    it('shows an error and stays logged out when no face is detected in frame', async () => {
      const { state, faceRecognition } = createState({ accessToken: 't', user: authenticatedUser({}) }, {
        existingEnrollment: enrollment(),
      });
      faceRecognition.captureDescriptor.mockResolvedValue(null);

      await state.startFacialRecognition(document.createElement('video'));

      expect(state.session()).toBeNull();
      expect(state.faceAuthError()).toContain('identificar um rosto');
    });

    it('shows an error and stays logged out when the captured face does not match', async () => {
      const { state, faceRecognition } = createState({ accessToken: 't', user: authenticatedUser({}) }, {
        existingEnrollment: enrollment(),
      });
      faceRecognition.isMatch.mockReturnValue(false);

      await state.startFacialRecognition(document.createElement('video'));

      expect(state.session()).toBeNull();
      expect(state.faceAuthError()).toContain('não reconhecido');
    });

    it('exchanges the stored device token for a real session on a matching face', async () => {
      const loginResult: LoginResult = {
        accessToken: 'real-jwt',
        user: authenticatedUser({ role: 'tecnico' }),
      };
      const { state, authApi, authToken } = createState(loginResult, {
        existingEnrollment: enrollment({ deviceToken: 'cred-1.the-secret' }),
      });

      await state.startFacialRecognition(document.createElement('video'));

      expect(authApi.deviceLogin).toHaveBeenCalledWith('cred-1.the-secret');
      expect(authToken.setToken).toHaveBeenCalledWith('real-jwt');
      expect(state.session()?.accessToken).toBe('real-jwt');
    });

    it('clears the local enrollment when the device token was revoked server-side (e.g. logged out elsewhere)', async () => {
      const { state, authApi, deviceAuth } = createState(
        { accessToken: 't', user: authenticatedUser({}) },
        { existingEnrollment: enrollment() },
      );
      authApi.deviceLogin.mockReturnValue(throwError(() => new Error('401')));

      await state.startFacialRecognition(document.createElement('video'));

      expect(deviceAuth.clear).toHaveBeenCalled();
      expect(state.hasFaceEnrollment()).toBe(false);
      expect(state.faceAuthError()).toContain('expirou');
    });
  });

  describe('enrollment after a real email/senha login', () => {
    it('offers enrollment instead of going straight home when this device has none yet', async () => {
      const { state } = createState({ accessToken: 't', user: authenticatedUser({}) });
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');

      await state.loginWithPassword();

      expect(state.enrollPromptOpen()).toBe(true);
      expect(state.screen()).toBe('login');
    });

    it('goes straight home when a device enrollment already exists', async () => {
      const { state } = createState(
        { accessToken: 't', user: authenticatedUser({}) },
        { existingEnrollment: enrollment() },
      );
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');

      await state.loginWithPassword();

      expect(state.enrollPromptOpen()).toBe(false);
      expect(state.screen()).toBe('home');
    });

    it('confirmFaceEnrollment saves the descriptor and device token locally, then proceeds home', async () => {
      const { state, authApi, deviceAuth } = createState({
        accessToken: 't',
        user: authenticatedUser({ email: 'tecnico@petsystem.local' }),
      });
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');
      await state.loginWithPassword();
      expect(state.enrollPromptOpen()).toBe(true);

      await state.confirmFaceEnrollment(document.createElement('video'));

      expect(authApi.issueDeviceToken).toHaveBeenCalled();
      expect(deviceAuth.save).toHaveBeenCalledWith(
        expect.objectContaining({ deviceToken: 'cred-1.secret' }),
      );
      expect(state.hasFaceEnrollment()).toBe(true);
      expect(state.enrollPromptOpen()).toBe(false);
      expect(state.screen()).toBe('home');
    });

    it('skipFaceEnrollment proceeds home without saving anything', async () => {
      const { state, deviceAuth } = createState({ accessToken: 't', user: authenticatedUser({}) });
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');
      await state.loginWithPassword();

      state.skipFaceEnrollment();

      expect(deviceAuth.save).not.toHaveBeenCalled();
      expect(state.hasFaceEnrollment()).toBe(false);
      expect(state.screen()).toBe('home');
    });
  });

  describe('logout', () => {
    it('revokes the device token server-side and clears the local enrollment', async () => {
      const { state, authApi, deviceAuth } = createState(
        { accessToken: 't', user: authenticatedUser({}) },
        { existingEnrollment: enrollment({ deviceToken: 'cred-1.the-secret' }) },
      );

      state.logout();
      await Promise.resolve(); // deixa a chamada de revogação (fire-and-forget) rodar

      expect(authApi.revokeDeviceToken).toHaveBeenCalledWith('cred-1.the-secret');
      expect(deviceAuth.clear).toHaveBeenCalled();
      expect(state.hasFaceEnrollment()).toBe(false);
    });

    it('still clears the local enrollment even when the server call fails (offline logout)', async () => {
      const { state, deviceAuth, authApi } = createState(
        { accessToken: 't', user: authenticatedUser({}) },
        { existingEnrollment: enrollment() },
      );
      authApi.revokeDeviceToken.mockReturnValue(throwError(() => new Error('offline')));

      state.logout();
      await Promise.resolve();

      expect(deviceAuth.clear).toHaveBeenCalled();
      expect(state.hasFaceEnrollment()).toBe(false);
    });
  });
});
