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
  requiresGasMonitoring,
  riskAreaNrs,
  stepsFor,
  teamMemberToBadge,
} from './pet-mock-data';
import { WorkPermitsApiService } from './services/work-permits-api.service';
import { TeamMembersApiService, UpdateTeamMemberPayload } from './services/team-members-api.service';
import { AuthApiService, AuthenticatedUser } from './services/auth-api.service';
import { AuthTokenService } from './services/auth-token.service';
import { DeviceAuthService, FaceEnrollment } from './services/device-auth.service';
import { FaceRecognitionService } from './services/face-recognition.service';

export type PortalRole = 'tecnico' | 'gestor' | 'equipe' | 'usuarios' | 'empresas';
export type TechnicianScreen =
  'login' | 'home' | 'nova' | 'emitida' | 'detalhe';
export type HomeTab = 'abertas' | 'fechadas';
export type AuthPhase = 'idle' | 'scan' | 'ok';
/** Como o técnico está entrando: biometria facial ou e-mail e senha. */
export type AuthMethod = 'facial' | 'senha';

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
  readonly teamMembers = signal<TeamMember[]>([...TEAM_MEMBERS]);

  constructor(
    private readonly workPermitsApi: WorkPermitsApiService,
    private readonly teamMembersApi: TeamMembersApiService,
    private readonly authApi: AuthApiService,
    private readonly authToken: AuthTokenService,
    private readonly deviceAuth: DeviceAuthService,
    private readonly faceRecognition: FaceRecognitionService,
  ) {
    this.loadFromBackend();
    const enrollment = this.deviceAuth.get();
    this.faceEnrollment.set(enrollment);
    // Sem cadastro de rosto neste aparelho, a aba de e-mail/senha é o
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
    const updated = await firstValueFrom(this.teamMembersApi.update(registration, patch));
    this.teamMembers.update((list) =>
      list.map((m) => (m.registration === registration ? updated : m)),
    );
  }

  async deleteTeamMember(registration: string): Promise<void> {
    await firstValueFrom(this.teamMembersApi.remove(registration));
    this.teamMembers.update((list) => list.filter((m) => m.registration !== registration));
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

  // ── Reconhecimento facial ────────────────────────────────────────────
  // Reconhecimento de verdade (câmera + face-api.js rodando no navegador),
  // mas só facilita a entrada de quem já tem conta: só funciona depois de
  // um primeiro login por e-mail/senha ter cadastrado um rosto NESTE
  // aparelho (ver confirmFaceEnrollment). O que fica salvo localmente é o
  // descritor (vetor de 128 números, não dá pra virar imagem de volta) +
  // um token de aparelho (nunca a senha) — casar o rosto é só a chave que
  // libera usar esse token pra pedir uma sessão de verdade ao back-end.
  readonly faceEnrollment = signal<FaceEnrollment | null>(null);
  readonly faceAuthError = signal<string | null>(null);
  readonly hasFaceEnrollment = computed(() => this.faceEnrollment() !== null);

  async startFacialRecognition(video: HTMLVideoElement | null): Promise<void> {
    if (this.authPhase() !== 'idle') return;
    const enrollment = this.faceEnrollment();
    if (!enrollment) {
      this.faceAuthError.set(
        'Nenhum rosto cadastrado neste aparelho ainda. Entre por e-mail e senha para habilitar.',
      );
      return;
    }
    if (!video) {
      this.faceAuthError.set('Câmera indisponível.');
      return;
    }
    this.faceAuthError.set(null);
    this.authPhase.set('scan');
    const descriptor = await this.faceRecognition.captureDescriptor(video);
    if (!descriptor) {
      this.authPhase.set('idle');
      this.faceAuthError.set(
        'Não foi possível identificar um rosto. Centralize o rosto no quadro e tente de novo.',
      );
      return;
    }
    if (!this.faceRecognition.isMatch(enrollment.descriptor, descriptor)) {
      this.authPhase.set('idle');
      this.faceAuthError.set('Rosto não reconhecido. Tente novamente ou entre por e-mail e senha.');
      return;
    }
    try {
      const result = await firstValueFrom(this.authApi.deviceLogin(enrollment.deviceToken));
      this.session.set(result);
      this.authToken.setToken(result.accessToken);
      this.authPhase.set('ok');
      setTimeout(() => {
        this.authPhase.set('idle');
        this.screen.set('home');
      }, 500);
    } catch {
      // Token do aparelho não vale mais (ex.: revogado num logout feito
      // enquanto este aparelho estava sem rede) — sem sessão de verdade
      // por trás, o cadastro local também não serve mais pra nada.
      this.deviceAuth.clear();
      this.faceEnrollment.set(null);
      this.authPhase.set('idle');
      this.faceAuthError.set('O reconhecimento deste aparelho expirou. Entre por e-mail e senha.');
    }
  }

  // ── Cadastro de reconhecimento facial (opt-in, após login real) ─────
  readonly enrollPromptOpen = signal(false);
  readonly enrolling = signal(false);
  readonly enrollError = signal<string | null>(null);

  async confirmFaceEnrollment(video: HTMLVideoElement | null): Promise<void> {
    if (this.enrolling()) return;
    this.enrolling.set(true);
    this.enrollError.set(null);
    try {
      if (!video) {
        this.enrollError.set('Câmera indisponível.');
        return;
      }
      const descriptor = await this.faceRecognition.captureDescriptor(video);
      if (!descriptor) {
        this.enrollError.set(
          'Não foi possível identificar um rosto. Centralize o rosto no quadro e tente de novo.',
        );
        return;
      }
      const { deviceToken } = await firstValueFrom(this.authApi.issueDeviceToken());
      const enrollment: FaceEnrollment = {
        descriptor: Array.from(descriptor),
        deviceToken,
        userLabel: this.session()?.user.email ?? '',
      };
      this.deviceAuth.save(enrollment);
      this.faceEnrollment.set(enrollment);
      this.enrollPromptOpen.set(false);
      this.screen.set('home');
    } catch {
      this.enrollError.set('Não foi possível habilitar o reconhecimento facial agora.');
    } finally {
      this.enrolling.set(false);
    }
  }

  skipFaceEnrollment(): void {
    this.enrollPromptOpen.set(false);
    this.screen.set('home');
  }

  // ── Login por e-mail e senha ────────────────────────────────────────
  // Chama o AuthModule do back-end (`POST /api/auth/login`), que valida a
  // credencial no banco e devolve o JWT.
  readonly authMethod = signal<AuthMethod>('facial');
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
  // Usuários (login, papel de acesso) exigem login de verdade (não o
  // facial, que é simulação) com papel de admin ou gestor. O back-end
  // aplica a mesma regra (RolesGuard em cada rota); isto é só para a UI
  // não oferecer um botão/aba que a API vai recusar.
  readonly canManageTeam = computed(() => {
    const role = this.session()?.user.role;
    return role === 'admin' || role === 'gestor' || role === 'platform-admin';
  });

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
      // Sem rosto cadastrado neste aparelho ainda: oferece habilitar antes
      // de seguir pra home (câmera continua ligada, tela de login ainda de
      // pé) — reconhecimento facial só facilita quem já tem conta, então
      // o primeiro acesso sempre passa por aqui.
      if (this.faceEnrollment()) {
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
    // "Lembrada até a pessoa clicar em Sair": sair precisa mesmo invalidar
    // o aparelho, não só limpar o token local — ver
    // AuthService.revokeDeviceToken no back-end. Melhor esforço: se a
    // chamada falhar (sem rede, por exemplo), o cadastro local já é limpo
    // de qualquer jeito, então o pior caso é um DeviceCredential órfão no
    // banco, nunca um acesso que deveria ter sido revogado continuando
    // válido no próprio aparelho.
    const enrollment = this.faceEnrollment();
    if (enrollment) {
      firstValueFrom(this.authApi.revokeDeviceToken(enrollment.deviceToken)).catch(() => undefined);
    }
    this.deviceAuth.clear();
    this.faceEnrollment.set(null);
    this.screen.set('login');
    this.authPhase.set('idle');
    this.session.set(null);
    this.authToken.setToken(null);
    this.loginEmail.set('');
    this.loginPassword.set('');
    this.loginError.set(null);
    this.faceAuthError.set(null);
    this.authMethod.set('senha');
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
