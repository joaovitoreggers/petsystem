import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AtmosphereAlert,
  Badge,
  BadgeItem,
  ChecklistAnswer,
  CriticalAlert,
  FireWatchRound,
  GAS_LIMITS,
  GasKey,
  GasReading,
  MOCK_BADGES,
  MOCK_PETS,
  Pet,
  PetTeamMember,
  PetTeamRole,
  RiskAreaId,
  TEAM_MEMBERS,
  TeamMember,
  WizardStepId,
  emptyFireWatchRounds,
  gasViolationMessage,
  petStatusView,
  requiresGasMonitoring,
  riskAreaNrs,
  stepsFor,
  teamMemberToBadge,
} from './pet-mock-data';
import { WorkPermitsApiService } from './services/work-permits-api.service';
import { TeamMembersApiService, UpdateTeamMemberPayload } from './services/team-members-api.service';
import { AuthApiService, AuthenticatedUser } from './services/auth-api.service';
import { AuthTokenService } from './services/auth-token.service';
import { DeviceAuthService, BiometricEnrollment } from './services/device-auth.service';
import { startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';

export type PortalRole = 'tecnico' | 'gestor' | 'equipe' | 'usuarios' | 'empresas';
export type TechnicianScreen =
  'login' | 'home' | 'nova' | 'emitida' | 'detalhe';
export type HomeTab = 'abertas' | 'fechadas';
export type AuthPhase = 'idle' | 'scan' | 'ok';
/** Como o técnico está entrando: biometria nativa do aparelho ou e-mail e senha. */
export type AuthMethod = 'biometria' | 'senha';

interface WizardFields {
  descricao: string;
  tipo: string;
  empresa: string;
  telefone: string;
  inicio: string;
  fim: string;
  local: string;
  unidade: string;
}

const EMPTY_FIELDS: WizardFields = {
  descricao: '',
  tipo: 'Manutenção corretiva',
  empresa: '',
  telefone: '',
  inicio: '',
  fim: '',
  local: '',
  unidade: 'Matelândia',
};

let nextPetSequence = 419;

/** Onde o cadastro editado sem servidor fica guardado no aparelho. */
const ROSTER_KEY = 'artech.pet.roster';

/**
 * Cadastro guardado no aparelho, se houver; senão, os dados de exemplo.
 *
 * Vem antes de qualquer chamada de rede: assim que o servidor responder,
 * loadFromBackend() substitui tudo pelo que vier de lá.
 */
function restoreRoster(): TeamMember[] {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as TeamMember[];
  } catch {
    // formato inesperado ou storage bloqueado — cai nos dados de exemplo
  }
  return [...TEAM_MEMBERS];
}

@Injectable({ providedIn: 'root' })
export class PetStateService {
  readonly role = signal<PortalRole>('tecnico');

  // ── Alerta e evacuação ──────────────────────────────────────────────
  // Vive aqui (não num componente) para ficar disponível em qualquer tela —
  // trocar de aba (técnico/gestor/funcionários) não deve silenciar a sirene
  // nem fechar o alerta de uma evacuação em curso.
  readonly evacuating = signal(false);

  private audioContext: AudioContext | null = null;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenIntervalId: ReturnType<typeof setInterval> | null = null;

  readonly alarmedPets = computed(() =>
    this.pets().filter((p) => p.alarm && p.status !== 'fechada'),
  );
  readonly hasAlert = computed(() => this.alarmedPets().length > 0);
  readonly alertText = computed(() => {
    const pet = this.alarmedPets()[0];
    if (!pet) return '';
    const alert = pet.atmosphereAlerts?.[0];
    if (alert) return `${pet.id} · ${pet.location} · ${alert.message}`;
    if (!pet.gas) return '';
    // Fallback para PETs de exemplo sem atmosphereAlerts (dado mockado).
    return `${pet.id} · ${pet.location} · H₂S em ${pet.gas.h2s.toFixed(1)} ppm, acima do limite de 8 ppm.`;
  });

  // PET explicitamente escolhida ao acionar a evacuação (ver o seletor no
  // painel de gestão) — sem escolha explícita, cai no primeiro alarme
  // (comportamento antigo, ainda usado pelo botão de pânico sempre visível
  // no topo, que aciona sem passar por um seletor).
  readonly evacuationPetId = signal<string | null>(null);
  readonly evacuationPet = computed(() => {
    const id = this.evacuationPetId();
    if (id) return this.pets().find((p) => p.id === id) ?? null;
    return this.alarmedPets()[0] ?? null;
  });
  readonly evacText = computed(() => {
    const pet = this.evacuationPet();
    if (!pet) return 'Retirada imediata das frentes de trabalho ativas.';
    return `${pet.id} · ${pet.location} · ${riskAreaNrs(pet.areas)}. Atmosfera fora do limite: retirada imediata da frente de trabalho.`;
  });

  triggerEvacuation(petId?: string): void {
    this.evacuationPetId.set(petId ?? null);
    this.startSiren();
    this.evacuating.set(true);
  }

  // Seletor "qual PET está sendo evacuada", compartilhado pelos dois
  // pontos de acionamento — o botão sempre visível na sidebar/topbar do
  // shell e o banner de alerta atmosférico do painel de gestão — para que
  // escolher a PET certa nunca dependa de por onde a evacuação foi
  // acionada.
  readonly evacuationPickerOpen = signal(false);
  readonly selectedEvacuationPetId = signal<string | null>(null);
  readonly evacuationCandidates = computed(() =>
    [...this.openPets()]
      .sort((a, b) => Number(!!b.alarm) - Number(!!a.alarm))
      .map((pet) => ({ pet, status: petStatusView(pet) })),
  );

  openEvacuationPicker(): void {
    const firstAlarmed = this.alarmedPets()[0];
    this.selectedEvacuationPetId.set(firstAlarmed?.id ?? this.evacuationCandidates()[0]?.pet.id ?? null);
    this.evacuationPickerOpen.set(true);
  }

  closeEvacuationPicker(): void {
    this.evacuationPickerOpen.set(false);
  }

  selectEvacuationPet(id: string): void {
    this.selectedEvacuationPetId.set(id);
  }

  confirmEvacuationPet(): void {
    const id = this.selectedEvacuationPetId();
    if (!id) return;
    this.triggerEvacuation(id);
    this.evacuationPickerOpen.set(false);
  }

  silenceSiren(): void {
    this.stopSiren();
  }

  finishEvacuation(): void {
    this.stopSiren();
    this.evacuating.set(false);
    this.evacuationPetId.set(null);
  }

  private startSiren(): void {
    try {
      this.stopSiren();
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = (this.audioContext ??= new AudioCtx());
      if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(760, ctx.currentTime);
      gain.gain.setValueAtTime(0.055, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      this.sirenOscillator = oscillator;
      let high = true;
      this.sirenIntervalId = setInterval(() => {
        high = !high;
        oscillator.frequency.setValueAtTime(high ? 760 : 520, ctx.currentTime);
      }, 420);
    } catch {
      // Web Audio unavailable — o alerta visual continua funcionando sem som.
    }
  }

  private stopSiren(): void {
    if (this.sirenIntervalId !== null) {
      clearInterval(this.sirenIntervalId);
      this.sirenIntervalId = null;
    }
    if (this.sirenOscillator) {
      try {
        this.sirenOscillator.stop();
      } catch {
        // já parado
      }
      this.sirenOscillator = null;
    }
  }

  // Estado inicial vem dos dados mockados; loadFromBackend() (chamado no
  // constructor) tenta substituí-lo pelo conteúdo real da API assim que o
  // back-end responde. Se a chamada falhar (back-end fora do ar, por
  // exemplo), a tela continua funcionando normalmente com o mock — é assim
  // que o MVP evita depender do back-end estar de pé para ser demonstrado.
  readonly pets = signal<Pet[]>([...MOCK_PETS]);
  readonly teamMembers = signal<TeamMember[]>(restoreRoster());

  constructor(
    private readonly workPermitsApi: WorkPermitsApiService,
    private readonly teamMembersApi: TeamMembersApiService,
    private readonly authApi: AuthApiService,
    private readonly authToken: AuthTokenService,
    private readonly deviceAuth: DeviceAuthService,
  ) {
    this.loadFromBackend();
    const enrollment = this.deviceAuth.get();
    this.biometricEnrollment.set(enrollment);
    // Sem passkey cadastrada neste aparelho, a aba de e-mail/senha é o
    // caminho óbvio de primeiro acesso — evita abrir numa aba que só ia
    // explicar que não dá pra usá-la ainda.
    if (!enrollment) {
      this.authMethod.set('senha');
    }
  }

  private async loadFromBackend(): Promise<void> {
    try {
      const pets = await firstValueFrom(this.workPermitsApi.findAll());
      if (pets.length > 0) this.pets.set(pets);
    } catch {
      // mantém os dados mockados como estão
    }
    try {
      const members = await firstValueFrom(this.teamMembersApi.findAll());
      if (members.length > 0) this.teamMembers.set(members);
    } catch {
      // mantém os dados mockados como estão
    }
  }

  async registerTeamMember(member: TeamMember): Promise<void> {
    try {
      const created = await firstValueFrom(this.teamMembersApi.create(member));
      this.teamMembers.update((list) => [...list, created]);
    } catch {
      this.teamMembers.update((list) => [...list, member]);
    }
  }

  /**
   * Exige sessão real (ver canManageTeam) — o back-end recusa com 401/403
   * sem o JWT de admin/gestor. Erros ficam para o chamador tratar; ao
   * contrário de registerTeamMember(), não há fallback local aqui, porque
   * "editar sem persistir" esconderia do usuário que a mudança não pegou.
   */
  async updateTeamMember(registration: string, patch: UpdateTeamMemberPayload): Promise<void> {
    if (this.demoMode()) {
      this.teamMembers.update((list) =>
        list.map((m) => (m.registration === registration ? { ...m, ...patch } : m)),
      );
      this.persistRoster();
      return;
    }
    const updated = await firstValueFrom(this.teamMembersApi.update(registration, patch));
    this.teamMembers.update((list) =>
      list.map((m) => (m.registration === registration ? updated : m)),
    );
  }

  async deleteTeamMember(registration: string): Promise<void> {
    if (this.demoMode()) {
      this.teamMembers.update((list) => list.filter((m) => m.registration !== registration));
      this.persistRoster();
      return;
    }
    await firstValueFrom(this.teamMembersApi.remove(registration));
    this.teamMembers.update((list) => list.filter((m) => m.registration !== registration));
  }

  /**
   * Guarda o cadastro no aparelho, no modo demonstração.
   *
   * Sem isso, a edição sumia ao recarregar a página: o estado vivia só na
   * memória da aba, e o F5 trazia de volta os dados de exemplo. Quando há
   * servidor, quem guarda é ele, e esta cópia nem é usada.
   */
  private persistRoster(): void {
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(this.teamMembers()));
    } catch {
      // Armazenamento indisponível: vale para esta sessão apenas.
    }
  }

  /** Descarta o cadastro local e volta aos dados de exemplo. */
  resetRoster(): void {
    try {
      localStorage.removeItem(ROSTER_KEY);
    } catch {
      // nada a fazer
    }
    this.teamMembers.set([...TEAM_MEMBERS]);
  }

  // ── Técnico: navegação e autenticação ──────────────────────────────
  readonly screen = signal<TechnicianScreen>('login');
  readonly authPhase = signal<AuthPhase>('idle');
  readonly homeTab = signal<HomeTab>('abertas');
  readonly detailPetId = signal<string | null>(null);
  readonly emittedPetId = signal<string | null>(null);

  // "Nova medição" na tela de detalhe: leitura manual pós-emissão, mesmo
  // modelo da etapa 3 do assistente — sem sensor conectado.
  readonly measurementDialogOpen = signal(false);
  readonly measurementGasInputs = signal<Record<GasKey, string>>({
    o2: '',
    co: '',
    h2s: '',
    lel: '',
  });

  readonly measurementGasReadingComplete = computed(() => {
    const inputs = this.measurementGasInputs();
    return (['o2', 'co', 'h2s', 'lel'] as GasKey[]).every(
      (k) => inputs[k].trim() !== '' && !Number.isNaN(Number(inputs[k])),
    );
  });

  readonly openPets = computed(() =>
    this.pets().filter((p) => p.status !== 'fechada'),
  );
  readonly closedPets = computed(() =>
    this.pets().filter((p) => p.status === 'fechada'),
  );
  readonly visiblePets = computed(() =>
    this.homeTab() === 'abertas' ? this.openPets() : this.closedPets(),
  );

  // ── Wizard "Nova PET" ───────────────────────────────────────────────
  readonly selectedAreas = signal<RiskAreaId[]>([]);
  readonly stepIndex = signal(0);
  readonly fields = signal<WizardFields>({ ...EMPTY_FIELDS });
  readonly checklistState = signal<Record<string, ChecklistAnswer>>({});
  // Leitura do detector portátil digitada manualmente pelo técnico — não há
  // simulação automática nem pareamento de aparelho, conforme a PET física.
  readonly gasInputs = signal<Record<GasKey, string>>({
    o2: '',
    co: '',
    h2s: '',
    lel: '',
  });
  readonly ventilationOn = signal(false);
  readonly gasReadingsLog = signal<{ time: string; text: string }[]>([]);
  readonly currentBadge = signal<Badge | null>(null);
  readonly badgeCycleIndex = signal(0);
  // Alternativa à leitura de crachá: buscar o funcionário já cadastrado
  // pelo nome ou matrícula e selecioná-lo — cai no mesmo `currentBadge`
  // (convertido pelo mesmo formato), então o preview e o botão de confirmar
  // continuam funcionando iguais para as duas origens.
  readonly employeeSearchQuery = signal('');
  readonly employeeSearchResults = computed(() => {
    const q = this.employeeSearchQuery().trim().toLowerCase();
    if (!q) return [];
    return TEAM_MEMBERS.filter(
      (m) => m.name.toLowerCase().includes(q) || m.registration.includes(q),
    ).slice(0, 6);
  });
  readonly authorizedTeam = signal<Badge[]>([]);
  // Vigia e resgatistas: papéis próprios na PET física (blocos de
  // identificação separados da equipe que executa o serviço), preenchidos
  // pela mesma leitura de crachá usada para a equipe.
  readonly vigiaTeam = signal<Badge[]>([]);
  readonly resgateTeam = signal<Badge[]>([]);
  // Qual dos 3 campos (técnico/vigia/socorrista) está com o painel de
  // adicionar aberto — nunca mais de um por vez, então basta um único
  // `currentBadge`/busca compartilhados entre eles.
  readonly addingRole = signal<PetTeamRole | null>(null);
  readonly fireWatchRounds = signal<FireWatchRound[]>(emptyFireWatchRounds());
  readonly technicianSigned = signal(false);
  readonly executorSigned = signal(false);

  // Foto do ponto de entrada anexada na etapa de checklist — só existe
  // durante o preenchimento do assistente, como as assinaturas.
  readonly sitePhoto = signal<string | null>(null);

  setSitePhoto(dataUrl: string | null): void {
    this.sitePhoto.set(dataUrl);
  }

  // Liberações com ressalva: funcionário com documentação vencida foi
  // admitido mesmo assim, por decisão do técnico. Fica visível durante o
  // assistente e vai junto no registro da PET (ver finishPet()).
  readonly criticalAlerts = signal<CriticalAlert[]>([]);

  readonly steps = computed<WizardStepId[]>(() =>
    stepsFor(this.selectedAreas()),
  );
  readonly currentStep = computed<WizardStepId | undefined>(
    () => this.steps()[this.stepIndex()],
  );
  readonly needsGasMonitoring = computed(() =>
    requiresGasMonitoring(this.selectedAreas()),
  );

  readonly liveGas = computed<GasReading>(() => {
    const inputs = this.gasInputs();
    const num = (v: string) =>
      v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v);
    return {
      o2: num(inputs.o2),
      co: num(inputs.co),
      h2s: num(inputs.h2s),
      lel: num(inputs.lel),
    };
  });

  readonly gasReadingComplete = computed(() => {
    const inputs = this.gasInputs();
    return (['o2', 'co', 'h2s', 'lel'] as GasKey[]).every(
      (k) => inputs[k].trim() !== '' && !Number.isNaN(Number(inputs[k])),
    );
  });

  setRole(role: PortalRole): void {
    this.role.set(role);
  }

  // ── Biometria nativa do aparelho (WebAuthn) ──────────────────────────
  // Face ID/Touch ID/Windows Hello/impressão digital — a chave privada
  // nunca sai do hardware seguro do aparelho; o servidor só guarda a chave
  // pública e verifica a assinatura de cada tentativa de login (ver
  // WebAuthnCredential no back-end). Só facilita a entrada de quem já tem
  // conta: cadastrar uma passkey exige sessão real (ver
  // confirmBiometricEnrollment). Sem `allowCredentials` nas opções de
  // login (ver AuthService.getLoginOptions no back-end), é o próprio
  // aparelho quem oferece a passkey certa — não é preciso digitar nada
  // antes de tentar.
  readonly biometricEnrollment = signal<BiometricEnrollment | null>(null);
  readonly biometricAuthError = signal<string | null>(null);
  readonly hasBiometricEnrollment = computed(() => this.biometricEnrollment() !== null);

  async startBiometricLogin(): Promise<void> {
    if (this.authPhase() !== 'idle') return;
    this.biometricAuthError.set(null);
    this.authPhase.set('scan');
    try {
      const { options, challengeId } = await firstValueFrom(
        this.authApi.getBiometricLoginOptions(),
      );
      const response = await startAuthentication({ optionsJSON: options });
      const result = await firstValueFrom(
        this.authApi.verifyBiometricLogin(challengeId, response),
      );
      this.session.set(result);
      this.authToken.setToken(result.accessToken);
      this.authPhase.set('ok');
      setTimeout(() => {
        this.authPhase.set('idle');
        this.screen.set('home');
      }, 500);
    } catch (err) {
      this.authPhase.set('idle');
      this.biometricAuthError.set(biometricErrorMessage(err));
    }
  }

  // ── Cadastro de biometria (opt-in, após login real) ──────────────────
  readonly enrollPromptOpen = signal(false);
  readonly enrolling = signal(false);
  readonly enrollError = signal<string | null>(null);

  async confirmBiometricEnrollment(): Promise<void> {
    if (this.enrolling()) return;
    this.enrolling.set(true);
    this.enrollError.set(null);
    try {
      const options = await firstValueFrom(this.authApi.getBiometricRegistrationOptions());
      const response = await startRegistration({ optionsJSON: options });
      await firstValueFrom(this.authApi.verifyBiometricRegistration(response));
      const enrollment: BiometricEnrollment = {
        credentialId: response.id,
        userLabel: this.session()?.user.email ?? '',
      };
      this.deviceAuth.save(enrollment);
      this.biometricEnrollment.set(enrollment);
      this.enrollPromptOpen.set(false);
      this.screen.set('home');
    } catch (err) {
      this.enrollError.set(biometricErrorMessage(err));
    } finally {
      this.enrolling.set(false);
    }
  }

  skipBiometricEnrollment(): void {
    this.enrollPromptOpen.set(false);
    this.screen.set('home');
  }

  /**
   * Ação explícita de "esquecer" a biometria deste aparelho — diferente de
   * sair (ver logout), que deliberadamente não mexe na passkey, do mesmo
   * jeito que fechar a sessão num site não apaga o Face ID salvo dele.
   */
  async forgetBiometricEnrollment(): Promise<void> {
    const enrollment = this.biometricEnrollment();
    if (!enrollment) return;
    try {
      await firstValueFrom(this.authApi.forgetBiometricCredential(enrollment.credentialId));
    } catch {
      // Melhor esforço: mesmo se a chamada falhar, o aparelho esquece
      // localmente de qualquer jeito.
    }
    this.deviceAuth.clear();
    this.biometricEnrollment.set(null);
    if (this.authMethod() === 'biometria') {
      this.authMethod.set('senha');
    }
  }

  // ── Login por e-mail e senha ────────────────────────────────────────
  // Chama o AuthModule do back-end (`POST /api/auth/login`), que valida a
  // credencial no banco e devolve o JWT.
  readonly authMethod = signal<AuthMethod>('biometria');
  readonly loginEmail = signal('');
  readonly loginPassword = signal('');
  readonly loginLoading = signal(false);
  readonly loginError = signal<string | null>(null);
  /** Sessão autenticada (JWT + usuário) enquanto o app estiver aberto. */
  readonly session = signal<{
    accessToken: string;
    user: AuthenticatedUser & { companyGroupName: string | null; branchName: string | null };
  } | null>(null);

  readonly canSubmitLogin = computed(
    () =>
      this.loginEmail().trim().length > 0 &&
      this.loginPassword().length > 0 &&
      !this.loginLoading(),
  );

  // Edição/exclusão de funcionários (NRs, vínculo) e o módulo inteiro de
  // Usuários (login, papel de acesso) exigem uma sessão real (JWT) com
  // papel de admin ou gestor — pouco importa se ela veio de e-mail/senha
  // ou de biometria nativa, as duas passam pelo mesmo back-end. O
  // back-end aplica a mesma regra (RolesGuard em cada rota); isto é só
  // para a UI não oferecer um botão/aba que a API vai recusar.
  /**
   * Sem sessão no servidor — antes de qualquer login, por qualquer meio.
   *
   * Neste estado o app roda inteiro sobre os dados de exemplo. Editar um
   * funcionário aqui grava no aparelho, e a tela diz isso com todas as
   * letras: o que não pode acontecer é a pessoa achar que gravou no
   * servidor quando não gravou.
   */
  readonly demoMode = computed(() => this.session() === null);

  /**
   * Alçada de verdade sobre o cadastro — a que o back-end também exige.
   *
   * Não afrouxa fora de sessão, de propósito: é o que decide se a aba
   * Usuários aparece e o que o servidor vai aceitar. Para a edição do
   * cadastro na tela, ver canEditRoster().
   */
  readonly canManageTeam = computed(() => {
    const role = this.session()?.user.role;
    return role === 'admin' || role === 'gestor' || role === 'platform-admin';
  });

  /**
   * A tela de Funcionários permite editar?
   *
   * Sim com alçada real, e sim também no modo demonstração — onde a
   * alteração fica gravada no aparelho e a tela diz isso. Sem esta
   * distinção, sem servidor no ar a edição simplesmente não existia para
   * quem usa o app: os botões nunca apareciam.
   *
   * Note que isto é permissão de interface, não de dados: quem decide o que
   * pode ser gravado no servidor é o back-end, que continua exigindo o JWT
   * com papel de admin ou gestor.
   */
  readonly canEditRoster = computed(
    () => this.canManageTeam() || this.demoMode(),
  );

  // Grupos de empresas/filiais (tenants) — só o platform-admin gerencia a
  // estrutura em si; ver a aba Empresas.
  readonly isPlatformAdmin = computed(
    () => this.session()?.user.role === 'platform-admin',
  );

  // Nome do tenant pra exibir na sidebar (ver PetShellComponent) — grupo
  // sozinho pra uma sessão que enxerga o grupo inteiro, "grupo · filial"
  // pra uma sessão restrita a uma filial. Nulo sem sessão real (facial) ou
  // pra platform-admin (não tem grupo próprio) — a sidebar cai no texto
  // fixo padrão nesses casos.
  readonly tenantLabel = computed(() => {
    const user = this.session()?.user;
    if (!user?.companyGroupName) return null;
    return user.branchName ? `${user.companyGroupName} · ${user.branchName}` : user.companyGroupName;
  });

  setAuthMethod(method: AuthMethod): void {
    this.authMethod.set(method);
    this.loginError.set(null);
  }

  setLoginEmail(value: string): void {
    this.loginEmail.set(value);
  }

  setLoginPassword(value: string): void {
    this.loginPassword.set(value);
  }

  async loginWithPassword(): Promise<void> {
    if (!this.canSubmitLogin()) return;
    this.loginLoading.set(true);
    this.loginError.set(null);
    try {
      const result = await firstValueFrom(
        this.authApi.login(this.loginEmail().trim(), this.loginPassword()),
      );
      this.session.set(result);
      this.authToken.setToken(result.accessToken);
      this.loginPassword.set('');
      // Sem passkey cadastrada neste aparelho ainda: oferece habilitar
      // antes de seguir pra home — a biometria nativa só facilita quem já
      // tem conta, então o primeiro acesso sempre passa por aqui.
      if (this.biometricEnrollment()) {
        this.screen.set('home');
      } else {
        this.enrollPromptOpen.set(true);
      }
    } catch (err) {
      // Sem atalho aqui: credencial não confere ou servidor fora do ar
      // significa não entrar.
      this.loginError.set(loginErrorMessage(err));
    } finally {
      this.loginLoading.set(false);
    }
  }

  logout(): void {
    // Diferente do token de aparelho antigo, uma passkey de verdade não é
    // revogada no logout — é assim que navegadores/gerenciadores de senha
    // se comportam (sair do site não apaga o Face ID salvo). Para remover
    // o cadastro deste aparelho, ver forgetBiometricEnrollment().
    this.screen.set('login');
    this.authPhase.set('idle');
    this.session.set(null);
    this.authToken.setToken(null);
    this.loginEmail.set('');
    this.loginPassword.set('');
    this.loginError.set(null);
    this.biometricAuthError.set(null);
    this.authMethod.set(this.biometricEnrollment() ? 'biometria' : 'senha');
  }

  selectHomeTab(tab: HomeTab): void {
    this.homeTab.set(tab);
  }

  openPetDetail(id: string): void {
    this.detailPetId.set(id);
    this.screen.set('detalhe');
  }

  goHome(): void {
    this.screen.set('home');
  }

  async encerrarPet(reason: string, closedBy: string): Promise<void> {
    const id = this.detailPetId();
    if (!id) return;
    const pet = this.pets().find((p) => p.id === id);
    const end = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const durationMinutes = pet ? minutesSince(pet.start) : 0;
    try {
      const closed = await firstValueFrom(
        this.workPermitsApi.close(id, {
          end,
          durationMinutes,
          reason,
          closedBy,
        }),
      );
      this.pets.update((list) => list.map((p) => (p.id === id ? closed : p)));
    } catch {
      this.pets.update((list) =>
        list.map((p) =>
          p.id === id
            ? {
                ...p,
                status: 'fechada' as const,
                end,
                durationMinutes,
                closeReason: reason,
                closedBy,
              }
            : p,
        ),
      );
    }
    this.goHome();
  }

  openMeasurementDialog(): void {
    this.measurementGasInputs.set({ o2: '', co: '', h2s: '', lel: '' });
    this.measurementDialogOpen.set(true);
  }

  closeMeasurementDialog(): void {
    this.measurementDialogOpen.set(false);
  }

  setMeasurementGasInput(key: GasKey, value: string): void {
    this.measurementGasInputs.update((inputs) => ({ ...inputs, [key]: value }));
  }

  async confirmMeasurement(): Promise<void> {
    if (!this.measurementGasReadingComplete()) return;
    const id = this.detailPetId();
    if (!id) return;
    const inputs = this.measurementGasInputs();
    const gas: GasReading = {
      o2: Number(inputs.o2),
      co: Number(inputs.co),
      h2s: Number(inputs.h2s),
      lel: Number(inputs.lel),
    };
    try {
      const updated = await firstValueFrom(
        this.workPermitsApi.addReading(id, gas),
      );
      this.pets.update((list) => list.map((p) => (p.id === id ? updated : p)));
    } catch {
      const time = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const text = `O₂ ${gas.o2.toFixed(1)}% · CO ${gas.co.toFixed(0)} ppm · H₂S ${gas.h2s.toFixed(1)} ppm · LEL ${gas.lel.toFixed(0)}%`;
      const violations = this.findGasViolations(gas, time);
      this.pets.update((list) =>
        list.map((p) =>
          p.id === id
            ? {
                ...p,
                gas,
                readings: [...(p.readings ?? []), { time, text }],
                atmosphereAlerts: [
                  ...violations,
                  ...(p.atmosphereAlerts ?? []),
                ],
                alarm: violations.length > 0,
              }
            : p,
        ),
      );
    }
    this.measurementDialogOpen.set(false);
  }

  private findGasViolations(
    gas: GasReading,
    timestamp: string,
  ): AtmosphereAlert[] {
    const keys: GasKey[] = ['o2', 'co', 'h2s', 'lel'];
    return keys.flatMap((key) => {
      const message = gasViolationMessage(key, gas[key]);
      if (!message) return [];
      return [
        {
          gas: key,
          value: gas[key],
          limitText: GAS_LIMITS[key].limitText,
          message,
          timestamp,
        },
      ];
    });
  }

  // ── Wizard ────────────────────────────────────────────────────────
  startNewPet(): void {
    this.selectedAreas.set([]);
    this.stepIndex.set(0);
    this.fields.set({ ...EMPTY_FIELDS });
    this.checklistState.set({});
    this.gasInputs.set({ o2: '', co: '', h2s: '', lel: '' });
    this.ventilationOn.set(false);
    this.gasReadingsLog.set([]);
    this.currentBadge.set(null);
    this.badgeCycleIndex.set(0);
    this.employeeSearchQuery.set('');
    this.addingRole.set(null);
    this.authorizedTeam.set([]);
    this.vigiaTeam.set([]);
    this.resgateTeam.set([]);
    this.fireWatchRounds.set(emptyFireWatchRounds());
    this.technicianSigned.set(false);
    this.executorSigned.set(false);
    this.criticalAlerts.set([]);
    this.sitePhoto.set(null);
    this.screen.set('nova');
  }

  editArea(): void {
    this.stepIndex.set(0);
  }

  toggleArea(id: RiskAreaId): void {
    this.selectedAreas.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  setField<K extends keyof WizardFields>(name: K, value: string): void {
    this.fields.update((f) => ({ ...f, [name]: value }));
  }

  setChecklistAnswer(key: string, answer: ChecklistAnswer): void {
    this.checklistState.update((state) => ({ ...state, [key]: answer }));
  }

  checklistAnswer(key: string): ChecklistAnswer | undefined {
    return this.checklistState()[key];
  }

  updateFireWatchRound(index: number, patch: Partial<FireWatchRound>): void {
    this.fireWatchRounds.update((rounds) =>
      rounds.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  // ── Gases (leitura manual) ──────────────────────────────────────────
  setGasInput(key: GasKey, value: string): void {
    this.gasInputs.update((inputs) => ({ ...inputs, [key]: value }));
  }

  toggleVentilation(): void {
    const turningOn = !this.ventilationOn();
    this.ventilationOn.set(turningOn);
    const time = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    this.gasReadingsLog.update((log) => [
      {
        time,
        text: turningOn
          ? 'Ventilação forçada ligada'
          : 'Ventilação forçada desligada',
      },
      ...log,
    ]);
  }

  registerReading(): void {
    const gas = this.liveGas();
    const time = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const text = `O₂ ${gas.o2.toFixed(1)}% · CO ${gas.co.toFixed(0)} ppm · H₂S ${gas.h2s.toFixed(1)} ppm · LEL ${gas.lel.toFixed(0)}%`;
    this.gasReadingsLog.update((log) => [{ time, text }, ...log]);
  }

  atmosphereOutOfRange(): boolean {
    const gas = this.liveGas();
    return (
      gas.o2 < 19.5 || gas.o2 > 23 || gas.co > 25 || gas.h2s > 8 || gas.lel > 10
    );
  }

  // ── Crachá ────────────────────────────────────────────────────────
  scanBadge(): void {
    const idx = this.badgeCycleIndex() % MOCK_BADGES.length;
    this.currentBadge.set(MOCK_BADGES[idx]);
    this.badgeCycleIndex.update((i) => i + 1);
    // Sem isso, um texto ainda digitado na busca (sem resultado escolhido)
    // ficava preso na tela junto do crachá recém-lido, sugerindo uma pessoa
    // que não é a que será realmente adicionada.
    this.employeeSearchQuery.set('');
  }

  setEmployeeSearchQuery(value: string): void {
    this.employeeSearchQuery.set(value);
  }

  selectEmployeeFromSearch(member: TeamMember): void {
    this.currentBadge.set(teamMemberToBadge(member));
    this.employeeSearchQuery.set('');
  }

  teamForRole(role: PetTeamRole): Badge[] {
    if (role === 'equipe') return this.authorizedTeam();
    if (role === 'vigia') return this.vigiaTeam();
    return this.resgateTeam();
  }

  private targetForRole(role: PetTeamRole): WritableSignal<Badge[]> {
    if (role === 'equipe') return this.authorizedTeam;
    if (role === 'vigia') return this.vigiaTeam;
    return this.resgateTeam;
  }

  toggleAddPanel(role: PetTeamRole): void {
    this.addingRole.set(this.addingRole() === role ? null : role);
    this.currentBadge.set(null);
    this.employeeSearchQuery.set('');
  }

  confirmAddCurrentBadge(): void {
    const role = this.addingRole();
    if (!role) return;
    const roleLabel = role === 'equipe' ? 'na equipe autorizada' : role === 'vigia' ? 'como vigia' : 'como resgatista';
    this.addBadgeTo(this.targetForRole(role), roleLabel);
    this.addingRole.set(null);
  }

  private addBadgeTo(target: WritableSignal<Badge[]>, roleLabel: string): void {
    const badge = this.currentBadge();
    if (!badge) return;
    if (!target().some((b) => b.registration === badge.registration)) {
      target.update((list) => [...list, badge]);
      const expiredDocs = badge.items.filter((i) => i.status === 'venc');
      if (expiredDocs.length > 0) {
        const timestamp = new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const alerts: CriticalAlert[] = expiredDocs.map((doc) => ({
          employeeName: badge.name,
          registration: badge.registration,
          documentName: doc.name,
          message: `${badge.name} (mat. ${badge.registration}) liberado ${roleLabel} com ${doc.name} vencido — decisão do técnico responsável.`,
          timestamp,
        }));
        this.criticalAlerts.update((list) => [...alerts, ...list]);
      }
    }
    this.currentBadge.set(null);
  }

  badgeIsCleared(badge: Badge): boolean {
    return !badge.items.some((i) => i.status === 'venc');
  }

  badgeExpiredDocs(badge: Badge): BadgeItem[] {
    return badge.items.filter((i) => i.status === 'venc');
  }

  // ── Assinaturas ──────────────────────────────────────────────────
  setTechnicianSigned(v: boolean): void {
    this.technicianSigned.set(v);
  }
  setExecutorSigned(v: boolean): void {
    this.executorSigned.set(v);
  }

  // ── Navegação do wizard ──────────────────────────────────────────
  canAdvance(): boolean {
    const step = this.currentStep();
    if (step === 'area') return this.selectedAreas().length > 0;
    if (step === 'gases')
      return this.gasReadingComplete() && !this.atmosphereOutOfRange();
    if (step === 'qr') return this.authorizedTeam().length > 0;
    if (step === 'sig') return this.technicianSigned() && this.executorSigned();
    return true;
  }

  advanceStepLabel(): string {
    const steps = this.steps();
    const isLast = this.stepIndex() === steps.length - 1;
    return isLast ? 'Emitir PET' : 'Avançar';
  }

  back(): void {
    if (this.screen() !== 'nova') {
      this.goHome();
      return;
    }
    if (this.stepIndex() === 0) {
      this.goHome();
      return;
    }
    this.stepIndex.update((i) => i - 1);
  }

  advance(): void {
    if (!this.canAdvance()) return;
    const steps = this.steps();
    const isLast = this.stepIndex() === steps.length - 1;
    if (isLast) {
      this.finishPet();
      return;
    }
    this.stepIndex.update((i) => i + 1);
  }

  private badgesToTeam(badges: Badge[], petRole: PetTeamRole): PetTeamMember[] {
    return badges.map((b) => ({
      name: b.name,
      registration: b.registration,
      role: b.role,
      petRole,
    }));
  }

  private async finishPet(): Promise<void> {
    const fields = this.fields();
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const areas = this.selectedAreas();
    const gas = this.needsGasMonitoring() ? this.liveGas() : undefined;
    const criticalAlerts = this.criticalAlerts();
    const team: PetTeamMember[] = [
      ...this.badgesToTeam(this.authorizedTeam(), 'equipe'),
      ...this.badgesToTeam(this.vigiaTeam(), 'vigia'),
      ...this.badgesToTeam(this.resgateTeam(), 'resgate'),
    ];
    const teamSize = team.length;
    // Rondas de vigia só existem de verdade em trabalho a quente (NR-18),
    // que não é uma área de risco selecionável no momento (ver RiskAreaId
    // em pet-mock-data.ts) — então isto nunca envia rondas preenchidas
    // hoje. Mantido pronto para quando o escopo crescer de novo.
    const fireWatchRounds = undefined;
    const payload = {
      areas,
      location: fields.local || 'Local não informado',
      unit: fields.unidade || 'Matelândia',
      teamSize,
      date: now.toISOString().slice(0, 10),
      start: time,
      technician: 'Bárbara M. Garlini',
      coordinates: '-25.2531, -53.9927',
      gas,
      criticalAlerts,
      team,
      companyPhone: fields.telefone || undefined,
      description: fields.descricao || undefined,
      serviceType: fields.tipo || undefined,
      executingCompany: fields.empresa || undefined,
      plannedStart: fields.inicio || undefined,
      plannedEnd: fields.fim || undefined,
      checklist: this.checklistState(),
      fireWatchRounds,
    };

    let pet: Pet;
    try {
      pet = await firstValueFrom(this.workPermitsApi.create(payload));
    } catch {
      pet = {
        id: `PET-2026-${String(nextPetSequence++).padStart(4, '0')}`,
        areas,
        location: payload.location,
        unit: payload.unit,
        teamSize: payload.teamSize,
        date: payload.date,
        start: time,
        end: '',
        timeLabel: time,
        technician: payload.technician,
        status: 'aberta',
        coordinates: payload.coordinates,
        gas,
        criticalAlerts,
        team,
        companyPhone: payload.companyPhone,
        description: payload.description,
        serviceType: payload.serviceType,
        executingCompany: payload.executingCompany,
        plannedStart: payload.plannedStart,
        plannedEnd: payload.plannedEnd,
        checklist: payload.checklist,
        fireWatchRounds: payload.fireWatchRounds,
      };
    }
    this.pets.update((list) => [pet, ...list]);
    this.emittedPetId.set(pet.id);
    this.screen.set('emitida');
  }
}

function minutesSince(startHHmm: string): number {
  const [hours, minutes] = startHHmm.split(':').map(Number);
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours || 0,
    minutes || 0,
  );
  return Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));
}

/**
 * Mensagem de falha de login, em português, para quem está na portaria.
 *
 * 401 vem do `LocalAuthGuard` (credencial não confere) e `status === 0` é
 * rede/servidor fora do ar — dois problemas diferentes que exigem ações
 * diferentes de quem está na tela, então não podem virar o mesmo texto.
 */
function loginErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 401) return 'E-mail ou senha inválidos.';
  if (status === 400) return 'Informe um e-mail válido e a senha.';
  if (status === 0 || status === undefined) {
    return 'Servidor de autenticação indisponível. Verifique se o back-end está no ar.';
  }
  const body = (err as { error?: { message?: unknown } })?.error;
  if (
    body &&
    typeof body === 'object' &&
    typeof body.message === 'string' &&
    body.message.trim()
  ) {
    return body.message;
  }
  return 'Não foi possível entrar agora. Tente novamente.';
}

/**
 * Mensagem de falha de biometria nativa (WebAuthn), em português.
 *
 * `WebAuthnError` cobre falhas do próprio navegador/autenticador (usuário
 * cancelou o prompt, aparelho sem biometria configurada etc.); um status
 * HTTP vem de o servidor recusar a cerimônia (desafio expirado, credencial
 * desconhecida) — os dois merecem textos diferentes do genérico de login
 * por senha.
 */
function biometricErrorMessage(err: unknown): string {
  if (err instanceof WebAuthnError) {
    if (err.code === 'ERROR_CEREMONY_ABORTED') return 'Verificação cancelada.';
    return 'Não foi possível confirmar a biometria neste aparelho.';
  }
  const status = (err as { status?: number })?.status;
  if (status === 401) return 'Biometria não reconhecida. Entre por e-mail e senha.';
  if (status === 0) return 'Servidor de autenticação indisponível.';
  return 'Não foi possível confirmar a biometria neste aparelho.';
}
