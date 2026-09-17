import { of, throwError } from 'rxjs';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';
import { PetStateService } from './pet-state.service';
import { LoginResult } from './services/auth-api.service';
import { BiometricEnrollment } from './services/device-auth.service';

// Mock explícito (com uma classe de verdade para WebAuthnError, não só
// jest.fn()): PetStateService faz `instanceof WebAuthnError` para distinguir
// "usuário cancelou o prompt" de outras falhas — um mock genérico quebraria
// esse `instanceof`, já que a classe real nunca é executada em teste (o
// browser real é quem mostra o prompt nativo).
jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
  startRegistration: jest.fn(),
  WebAuthnError: class WebAuthnError extends Error {
    code: string;
    constructor(opts: { message: string; code: string }) {
      super(opts.message);
      this.code = opts.code;
      this.name = 'WebAuthnError';
    }
  },
}));

const mockStartAuthentication = startAuthentication as jest.Mock;
const mockStartRegistration = startRegistration as jest.Mock;

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

function enrollment(overrides: Partial<BiometricEnrollment> = {}): BiometricEnrollment {
  return {
    credentialId: 'cred-1',
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
  options: { existingEnrollment?: BiometricEnrollment | null } = {},
) {
  const workPermitsApi = { findAll: jest.fn(() => throwError(() => new Error('unauthenticated'))) };
  const teamMembersApi = { findAll: jest.fn(() => throwError(() => new Error('unauthenticated'))) };
  const authApi = {
    login: jest.fn(() => of(loginResult)),
    getBiometricRegistrationOptions: jest.fn(() =>
      of({} as PublicKeyCredentialCreationOptionsJSON),
    ),
    verifyBiometricRegistration: jest.fn(() => of(undefined)),
    getBiometricLoginOptions: jest.fn(() =>
      of({
        options: {} as PublicKeyCredentialRequestOptionsJSON,
        challengeId: 'challenge-1',
      }),
    ),
    verifyBiometricLogin: jest.fn(() => of(loginResult)),
    forgetBiometricCredential: jest.fn(() => of(undefined)),
  };
  const authToken = { setToken: jest.fn(), getToken: jest.fn() };
  const deviceAuth = {
    get: jest.fn(() => options.existingEnrollment ?? null),
    save: jest.fn(),
    clear: jest.fn(),
  };

  const state = new PetStateService(
    workPermitsApi as never,
    teamMembersApi as never,
    authApi as never,
    authToken as never,
    deviceAuth as never,
  );
  return { state, authApi, authToken, deviceAuth };
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

describe('PetStateService — biometria nativa do aparelho (facilita acesso de quem já tem conta)', () => {
  beforeEach(() => {
    mockStartAuthentication.mockReset();
    mockStartRegistration.mockReset();
  });

  it('has no biometric enrollment on a fresh device', () => {
    const { state } = createState({ accessToken: 't', user: authenticatedUser({}) });

    expect(state.hasBiometricEnrollment()).toBe(false);
    expect(state.authMethod()).toBe('senha');
  });

  it('loads an existing enrollment from this device on startup', () => {
    const existing = enrollment();
    const { state } = createState({ accessToken: 't', user: authenticatedUser({}) }, {
      existingEnrollment: existing,
    });

    expect(state.hasBiometricEnrollment()).toBe(true);
    expect(state.authMethod()).toBe('biometria');
  });

  describe('startBiometricLogin', () => {
    it('fetches login options, runs the platform ceremony, and exchanges the signed assertion for a real session', async () => {
      const loginResult: LoginResult = {
        accessToken: 'real-jwt',
        user: authenticatedUser({ role: 'tecnico' }),
      };
      const { state, authApi, authToken } = createState(loginResult);
      const optionsJSON = { challenge: 'c' } as PublicKeyCredentialRequestOptionsJSON;
      authApi.getBiometricLoginOptions.mockReturnValue(
        of({ options: optionsJSON, challengeId: 'challenge-1' }),
      );
      const response = { id: 'cred-1' } as AuthenticationResponseJSON;
      mockStartAuthentication.mockResolvedValue(response);

      await state.startBiometricLogin();

      expect(mockStartAuthentication).toHaveBeenCalledWith({ optionsJSON });
      expect(authApi.verifyBiometricLogin).toHaveBeenCalledWith('challenge-1', response);
      expect(authToken.setToken).toHaveBeenCalledWith('real-jwt');
      expect(state.session()?.accessToken).toBe('real-jwt');
      expect(state.biometricAuthError()).toBeNull();
    });

    it('shows a friendly message and stays logged out when the user cancels the platform prompt', async () => {
      const { state } = createState({ accessToken: 't', user: authenticatedUser({}) });
      mockStartAuthentication.mockRejectedValue(
        new WebAuthnError({ message: 'aborted', code: 'ERROR_CEREMONY_ABORTED' }),
      );

      await state.startBiometricLogin();

      expect(state.session()).toBeNull();
      expect(state.biometricAuthError()).toBe('Verificação cancelada.');
      expect(state.authPhase()).toBe('idle');
    });

    it('shows a clear message when the server rejects the signed assertion (unknown/expired credential)', async () => {
      const { state, authApi } = createState({ accessToken: 't', user: authenticatedUser({}) });
      mockStartAuthentication.mockResolvedValue({ id: 'cred-1' } as AuthenticationResponseJSON);
      authApi.verifyBiometricLogin.mockReturnValue(
        throwError(() => Object.assign(new Error('401'), { status: 401 })),
      );

      await state.startBiometricLogin();

      expect(state.session()).toBeNull();
      expect(state.biometricAuthError()).toContain('não reconhecida');
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

    it('confirmBiometricEnrollment fetches registration options, runs the ceremony, verifies it server-side, and saves the credential id locally', async () => {
      const { state, authApi, deviceAuth } = createState({
        accessToken: 't',
        user: authenticatedUser({ email: 'tecnico@petsystem.local' }),
      });
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');
      await state.loginWithPassword();
      expect(state.enrollPromptOpen()).toBe(true);

      const response = { id: 'new-cred-id' } as RegistrationResponseJSON;
      mockStartRegistration.mockResolvedValue(response);

      await state.confirmBiometricEnrollment();

      expect(authApi.getBiometricRegistrationOptions).toHaveBeenCalled();
      expect(authApi.verifyBiometricRegistration).toHaveBeenCalledWith(response);
      expect(deviceAuth.save).toHaveBeenCalledWith(
        expect.objectContaining({ credentialId: 'new-cred-id' }),
      );
      expect(state.hasBiometricEnrollment()).toBe(true);
      expect(state.enrollPromptOpen()).toBe(false);
      expect(state.screen()).toBe('home');
    });

    it('sets an error and keeps the dialog open when the platform ceremony fails', async () => {
      const { state } = createState({
        accessToken: 't',
        user: authenticatedUser({ email: 'tecnico@petsystem.local' }),
      });
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');
      await state.loginWithPassword();
      mockStartRegistration.mockRejectedValue(
        new WebAuthnError({ message: 'aborted', code: 'ERROR_CEREMONY_ABORTED' }),
      );

      await state.confirmBiometricEnrollment();

      expect(state.enrollError()).toBe('Verificação cancelada.');
      expect(state.enrollPromptOpen()).toBe(true);
      expect(state.hasBiometricEnrollment()).toBe(false);
    });

    it('skipBiometricEnrollment proceeds home without saving anything', async () => {
      const { state, deviceAuth } = createState({ accessToken: 't', user: authenticatedUser({}) });
      state.setLoginEmail('tecnico@petsystem.local');
      state.setLoginPassword('senha123');
      await state.loginWithPassword();

      state.skipBiometricEnrollment();

      expect(deviceAuth.save).not.toHaveBeenCalled();
      expect(state.hasBiometricEnrollment()).toBe(false);
      expect(state.screen()).toBe('home');
    });
  });

  describe('logout', () => {
    it('does NOT clear the local biometric enrollment — a passkey survives logout, the same way a browser-saved one does', () => {
      const { state, authApi, deviceAuth } = createState(
        { accessToken: 't', user: authenticatedUser({}) },
        { existingEnrollment: enrollment() },
      );

      state.logout();

      expect(authApi.forgetBiometricCredential).not.toHaveBeenCalled();
      expect(deviceAuth.clear).not.toHaveBeenCalled();
      expect(state.hasBiometricEnrollment()).toBe(true);
      expect(state.authMethod()).toBe('biometria');
    });

    it('falls back to the senha tab after logout when this device has no enrollment', () => {
      const { state } = createState({ accessToken: 't', user: authenticatedUser({}) });

      state.logout();

      expect(state.authMethod()).toBe('senha');
    });
  });

  describe('forgetBiometricEnrollment', () => {
    it('calls the server to forget the credential and clears it locally', async () => {
      const { state, authApi, deviceAuth } = createState(
        { accessToken: 't', user: authenticatedUser({}) },
        { existingEnrollment: enrollment({ credentialId: 'cred-1' }) },
      );

      await state.forgetBiometricEnrollment();

      expect(authApi.forgetBiometricCredential).toHaveBeenCalledWith('cred-1');
      expect(deviceAuth.clear).toHaveBeenCalled();
      expect(state.hasBiometricEnrollment()).toBe(false);
      expect(state.authMethod()).toBe('senha');
    });

    it('still clears locally even when the server call fails (offline)', async () => {
      const { state, deviceAuth, authApi } = createState(
        { accessToken: 't', user: authenticatedUser({}) },
        { existingEnrollment: enrollment() },
      );
      authApi.forgetBiometricCredential.mockReturnValue(throwError(() => new Error('offline')));

      await state.forgetBiometricEnrollment();

      expect(deviceAuth.clear).toHaveBeenCalled();
      expect(state.hasBiometricEnrollment()).toBe(false);
    });
  });
});
