import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AtmosphereAlert,
  Badge,
  BadgeItem,
  ChecklistAnswer,
  ChecklistCustomItem,
  CompanyLocation,
  CriticalAlert,
  EmergencyContact,
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
  buildChecklistGroups,
  emptyFireWatchRounds,
  gasViolationMessage,
  petStatusView,
  requiresGasMonitoring,
  riskAreaNrs,
  stepsFor,
  teamMemberToBadge,
} from './pet-mock-data';
import { CreateWorkPermitPayload, WorkPermitsApiService } from './services/work-permits-api.service';
import { WorkPermitSignature } from './services/work-permit-signatures-api.service';
import { TeamMembersApiService, UpdateTeamMemberPayload } from './services/team-members-api.service';
import {
  CompanyLocationsApiService,
  CreateCompanyLocationPayload,
  UpdateCompanyLocationPayload,
} from './services/company-locations-api.service';
import {
  CreateEmergencyContactPayload,
  EmergencyContactsApiService,
  UpdateEmergencyContactPayload,
} from './services/emergency-contacts-api.service';
import { EvacuationApiService } from './services/evacuation-api.service';
import {
  ChecklistItemsApiService,
  CreateChecklistItemPayload,
  UpdateChecklistItemPayload,
} from './services/checklist-items-api.service';
import { AuthApiService, AuthenticatedUser } from './services/auth-api.service';
import { AuthTokenService } from './services/auth-token.service';
import { DeviceAuthService, BiometricEnrollment } from './services/device-auth.service';
import { startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';

export type PortalRole = 'tecnico' | 'gestor' | 'equipe' | 'locais' | 'brigada' | 'checklist' | 'usuarios' | 'empresas';
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
  // trocar de aba (técnico/gestor/funcionários) não deve fechar o alerta
  // de uma evacuação em curso nem perder o resultado do envio.
  readonly evacuating = signal(false);

  // Acompanha o disparo de SMS/WhatsApp pra brigada (ver EvacuationModule
  // no back-end) — substituiu a sirene sonora local, que só quem estivesse
  // com o navegador aberto e o som ligado ouvia.
  readonly evacuationAlertId = signal<string | null>(null);
  readonly evacuationStatusLink = signal<string | null>(null);
  readonly evacuationContactsNotified = signal(0);
  // 'error' é a chamada em si não ter completado (rede/sessão) — nesse
  // caso `evacuationContactsNotified` nunca chega a ser atualizado, então
  // precisa de um estado próprio, senão a tela diria "nenhum contato
  // cadastrado" mesmo quando existem e só não foi possível perguntar.
  // 'failed' é a chamada ter completado mas nenhum envio individual ter
  // ido (ex. Twilio configurado, mas rejeitando as mensagens).
  readonly evacuationNotifyState = signal<
    'sending' | 'sent' | 'failed' | 'not_configured' | 'error' | null
  >(null);

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

  async triggerEvacuation(petId?: string): Promise<void> {
    this.evacuationPetId.set(petId ?? null);
    this.evacuating.set(true);
    this.evacuationAlertId.set(null);
    this.evacuationStatusLink.set(null);
    this.evacuationContactsNotified.set(0);
    this.evacuationNotifyState.set('sending');
    try {
      const result = await firstValueFrom(this.evacuationApi.trigger(petId ?? null));
      this.evacuationAlertId.set(result.alertId);
      this.evacuationStatusLink.set(result.statusUrl);
      this.evacuationContactsNotified.set(result.contactsNotified);
      const anyConfigured = result.deliveries.some(
        (d) => d.sms !== 'not_configured' || d.whatsapp !== 'not_configured',
      );
      const anySent = result.deliveries.some((d) => d.sms === 'sent' || d.whatsapp === 'sent');
      this.evacuationNotifyState.set(!anyConfigured ? 'not_configured' : anySent ? 'sent' : 'failed');
    } catch {
      this.evacuationNotifyState.set('error');
    }
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

  async finishEvacuation(): Promise<void> {
    const alertId = this.evacuationAlertId();
    this.evacuating.set(false);
    this.evacuationPetId.set(null);
    this.evacuationAlertId.set(null);
    this.evacuationStatusLink.set(null);
    this.evacuationNotifyState.set(null);
    this.evacuationContactsNotified.set(0);
    if (alertId) {
      try {
        await firstValueFrom(this.evacuationApi.resolve(alertId));
      } catch {
        // best-effort — a página pública só deixa de mostrar "encerrada",
        // o encerramento local já valeu.
      }
    }
  }

  // Estado inicial vem dos dados mockados; loadFromBackend() (chamado no
  // constructor) tenta substituí-lo pelo conteúdo real da API assim que o
  // back-end responde. Se a chamada falhar (back-end fora do ar, por
  // exemplo), a tela continua funcionando normalmente com o mock — é assim
  // que o MVP evita depender do back-end estar de pé para ser demonstrado.
  readonly pets = signal<Pet[]>([...MOCK_PETS]);
  readonly teamMembers = signal<TeamMember[]>(restoreRoster());
  // Sem mock local de propósito — diferente de pets/teamMembers, não há um
  // acervo de exemplo prévio à API pra cair de volta; começa vazio até
  // loadFromBackend() responder, e a tela de Locais/o assistente mostram
  // "nenhum local cadastrado ainda" nesse meio-tempo.
  readonly companyLocations = signal<CompanyLocation[]>([]);

  // Mesmo raciocínio de companyLocations: sem mock local, começa vazia até
  // loadFromBackend() responder.
  readonly emergencyContacts = signal<EmergencyContact[]>([]);

  // Idem — itens de checklist que a empresa cadastrou além do mínimo fixo
  // de cada NR (ver checklistGroups mais abaixo e buildChecklistGroups em
  // pet-mock-data.ts).
  readonly customChecklistItems = signal<ChecklistCustomItem[]>([]);

  constructor(
    private readonly workPermitsApi: WorkPermitsApiService,
    private readonly teamMembersApi: TeamMembersApiService,
    private readonly companyLocationsApi: CompanyLocationsApiService,
    private readonly emergencyContactsApi: EmergencyContactsApiService,
    private readonly evacuationApi: EvacuationApiService,
    private readonly checklistItemsApi: ChecklistItemsApiService,
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
    try {
      const locations = await firstValueFrom(this.companyLocationsApi.findAll());
      this.companyLocations.set(locations);
    } catch {
      // mantém a lista vazia — sem mock local pra este recurso
    }
    try {
      const contacts = await firstValueFrom(this.emergencyContactsApi.findAll());
      this.emergencyContacts.set(contacts);
    } catch {
      // mantém a lista vazia — sem mock local pra este recurso
    }
    try {
      const items = await firstValueFrom(this.checklistItemsApi.findAll());
      this.customChecklistItems.set(items);
    } catch {
      // mantém a lista vazia — sem mock local pra este recurso
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
   * Cadastro de local (tela "Locais"): qualquer sessão real pode criar,
   * mesma exigência de registerTeamMember — só login, sem papel específico.
   * Fallback local se a API falhar, pelo mesmo motivo: um cadastro que
   * "sumiu" sem aviso seria pior que um cadastro que só não persistiu.
   */
  async registerCompanyLocation(location: CreateCompanyLocationPayload): Promise<void> {
    try {
      const created = await firstValueFrom(this.companyLocationsApi.create(location));
      this.companyLocations.update((list) => [...list, created]);
    } catch {
      this.companyLocations.update((list) => [...list, { ...location, id: `local-${Date.now()}` }]);
    }
  }

  /**
   * Exige sessão real de admin/gestor (ver RolesGuard no back-end) — ao
   * contrário de registerCompanyLocation(), não há fallback local aqui
   * pelo mesmo motivo de updateTeamMember(): editar sem persistir
   * esconderia do usuário que a mudança não pegou.
   */
  async updateCompanyLocation(id: string, patch: UpdateCompanyLocationPayload): Promise<void> {
    const updated = await firstValueFrom(this.companyLocationsApi.update(id, patch));
    this.companyLocations.update((list) => list.map((l) => (l.id === id ? updated : l)));
  }

  async deleteCompanyLocation(id: string): Promise<void> {
    await firstValueFrom(this.companyLocationsApi.remove(id));
    this.companyLocations.update((list) => list.filter((l) => l.id !== id));
  }

  // Mesmo padrão de registerCompanyLocation: qualquer sessão real pode
  // cadastrar um contato de brigada, com fallback local se a API falhar.
  async registerEmergencyContact(contact: CreateEmergencyContactPayload): Promise<void> {
    try {
      const created = await firstValueFrom(this.emergencyContactsApi.create(contact));
      this.emergencyContacts.update((list) => [...list, created]);
    } catch {
      this.emergencyContacts.update((list) => [...list, { ...contact, id: `local-${Date.now()}` }]);
    }
  }

  async updateEmergencyContact(id: string, patch: UpdateEmergencyContactPayload): Promise<void> {
    const updated = await firstValueFrom(this.emergencyContactsApi.update(id, patch));
    this.emergencyContacts.update((list) => list.map((c) => (c.id === id ? updated : c)));
  }

  async deleteEmergencyContact(id: string): Promise<void> {
    await firstValueFrom(this.emergencyContactsApi.remove(id));
    this.emergencyContacts.update((list) => list.filter((c) => c.id !== id));
  }

  // Mesmo padrão de registerEmergencyContact: qualquer sessão real pode
  // cadastrar um item de checklist, com fallback local se a API falhar.
  async registerChecklistItem(item: CreateChecklistItemPayload): Promise<void> {
    try {
      const created = await firstValueFrom(this.checklistItemsApi.create(item));
      this.customChecklistItems.update((list) => [...list, created]);
    } catch {
      this.customChecklistItems.update((list) => [...list, { ...item, id: `local-${Date.now()}` }]);
    }
  }

  async updateChecklistItem(id: string, patch: UpdateChecklistItemPayload): Promise<void> {
    const updated = await firstValueFrom(this.checklistItemsApi.update(id, patch));
    this.customChecklistItems.update((list) => list.map((i) => (i.id === id ? updated : i)));
  }

  async deleteChecklistItem(id: string): Promise<void> {
    await firstValueFrom(this.checklistItemsApi.remove(id));
    this.customChecklistItems.update((list) => list.filter((i) => i.id !== id));
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

  // Exige sessão real (RolesGuard admin/gestor/tecnico no back-end) — sem
  // fallback local em modo demonstração, pelo mesmo motivo de
  // updateTeamMember(): um PIN que parece definido mas nunca chegou ao
  // servidor falharia silenciosamente na hora de assinar de verdade.
  async setTeamMemberPin(registration: string, pin: string): Promise<void> {
    await firstValueFrom(this.teamMembersApi.setPin(registration, pin));
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

  // ── Assinatura eletrônica (abertura) ──────────────────────────────
  // Id que amarra as assinaturas de emitente/executante umas às outras e,
  // depois, à PET criada — gerado de novo a cada "Nova PET" (ver
  // startNewPet()). Precisa existir antes da PET (que só ganha id real na
  // criação), daí um id à parte gerado no front-end.
  readonly draftId = signal<string>(crypto.randomUUID());

  // Coordenada capturada pelo painel de assinatura do emitente (best-effort
  // — ausente se a geolocalização foi negada/indisponível), usada como
  // `coordinates` da PET. Substitui a coordenada fake que existia antes.
  readonly emitenteCoordinates = signal<string | null>(null);

  setEmitenteCoordinates(value: string | null): void {
    this.emitenteCoordinates.set(value);
  }

  // `date`/`start` da PET são capturados uma única vez, ao entrar na etapa
  // de assinatura — não recalculados a cada requisição (options/verify de
  // cada signatário, depois a criação em si), porque o back-end recalcula o
  // hash do conteúdo assinado a cada uma dessas chamadas e exige que bata;
  // um relógio "agora" diferente em cada chamada quebraria essa conferência
  // sem que o conteúdo tivesse realmente mudado.
  private readonly openingTimestamp = signal<{ date: string; start: string } | null>(null);

  ensureOpeningTimestamp(): void {
    if (this.openingTimestamp()) return;
    const now = new Date();
    this.openingTimestamp.set({
      date: now.toISOString().slice(0, 10),
      start: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // Qual membro já adicionado à equipe é o "executante responsável" que
  // assina a abertura — por padrão o primeiro adicionado; a pessoa pode
  // trocar via setExecutorRegistration() se houver mais de um. Recalcula
  // sozinho se a escolhida for removida da equipe.
  private readonly executorRegistrationOverride = signal<string | null>(null);
  readonly executorRegistration = computed<string | null>(() => {
    const team = this.authorizedTeam();
    const override = this.executorRegistrationOverride();
    if (override && team.some((b) => b.registration === override)) return override;
    return team[0]?.registration ?? null;
  });
  readonly executorMember = computed<Badge | null>(() => {
    const registration = this.executorRegistration();
    return registration ? this.authorizedTeam().find((b) => b.registration === registration) ?? null : null;
  });

  setExecutorRegistration(registration: string): void {
    this.executorRegistrationOverride.set(registration);
  }

  // Snapshot canônico do que está sendo assinado na abertura — exatamente
  // os mesmos campos que WorkPermitsService.buildOpeningSnapshot() recorta
  // do corpo recebido no back-end (ver opening-snapshot.ts); os dois lados
  // precisam concordar byte a byte, senão o hash não bate e o back-end
  // rejeita a criação com 409 mesmo sem nada ter mudado de verdade.
  readonly openingContentSnapshot = computed<Record<string, unknown>>(() => {
    const fields = this.fields();
    const timestamp = this.openingTimestamp();
    const team: PetTeamMember[] = [
      ...this.badgesToTeam(this.authorizedTeam(), 'equipe'),
      ...this.badgesToTeam(this.vigiaTeam(), 'vigia'),
      ...this.badgesToTeam(this.resgateTeam(), 'resgate'),
    ];
    return {
      areas: this.selectedAreas(),
      location: fields.local || 'Local não informado',
      unit: fields.unidade || 'Matelândia',
      teamSize: team.length,
      date: timestamp?.date ?? '',
      start: timestamp?.start ?? '',
      gas: this.needsGasMonitoring() ? this.liveGas() : null,
      criticalAlerts: this.criticalAlerts(),
      team,
      companyPhone: fields.telefone || null,
      description: fields.descricao || null,
      serviceType: fields.tipo || null,
      executingCompany: fields.empresa || null,
      plannedStart: fields.inicio || null,
      plannedEnd: fields.fim || null,
      checklist: this.checklistState(),
      // Rondas de vigia só existem de verdade em trabalho a quente (NR-18),
      // que não é uma área de risco selecionável hoje — sempre vazio, mas
      // precisa ser `[]` (não `undefined`) pra bater com o que o back-end
      // recompõe em buildOpeningSnapshot() (`dto.fireWatchRounds ?? []`).
      fireWatchRounds: [] as unknown[],
    };
  });

  readonly finishingPet = signal(false);
  readonly finishPetError = signal<string | null>(null);

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

  // Checklist bloqueante — mesmo princípio da atmosfera fora do limite
  // (ver canAdvance()): item sem resposta ou marcado NÃO significa uma
  // condição de segurança não atendida, e emitir a PET assim faria a
  // permissão em papel mentir sobre o que foi de fato conferido. É
  // literalmente o texto do Anexo II da NR-33 ("a entrada deve ser
  // proibida se algum campo não for preenchido ou contiver a marca
  // 'não'"), mas vale pro checklist inteiro (EPI + todas as áreas
  // selecionadas), não só pros itens da NR-33 — a etapa é uma só.
  readonly checklistGroups = computed(() =>
    buildChecklistGroups(this.selectedAreas(), this.customChecklistItems()),
  );
  readonly checklistUnansweredCount = computed(() => {
    const answers = this.checklistState();
    return this.checklistGroups().reduce(
      (count, group) =>
        count + group.items.filter((item) => !(item.key in answers)).length,
      0,
    );
  });
  readonly checklistNaoCount = computed(
    () => Object.values(this.checklistState()).filter((a) => a === 'nao').length,
  );
  readonly checklistBlocked = computed(
    () => this.checklistUnansweredCount() > 0 || this.checklistNaoCount() > 0,
  );

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
      // loadFromBackend() já rodou uma vez no construtor, sem token —
      // tudo que exige sessão (pets, funcionários, locais, brigada) tinha
      // voltado 401 e ficado no mock/vazio. Com o token de verdade em
      // mãos agora, busca de novo pra trocar isso pelos dados reais do
      // tenant.
      this.loadFromBackend();
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
    user: AuthenticatedUser & { name: string; companyGroupName: string | null; branchName: string | null };
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

  /**
   * Quem pode definir/alterar o PIN de assinatura (crachá + PIN) de um
   * funcionário — mais permissivo que canManageTeam() porque o back-end
   * também libera para 'tecnico' (ver TeamMembersController.setPin): é o
   * técnico em campo, não só admin/gestor, quem normalmente cadastra esse
   * PIN na hora de preparar a equipe pra assinar. Sem fallback de modo
   * demonstração — ver setTeamMemberPin().
   */
  readonly canSetTeamMemberPin = computed(() => {
    const role = this.session()?.user.role;
    return role === 'admin' || role === 'gestor' || role === 'tecnico' || role === 'platform-admin';
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
      // Mesmo motivo do login por biometria: refaz a carga agora que há
      // um token de verdade, pra sair do mock/vazio e mostrar os dados
      // reais do tenant.
      this.loadFromBackend();
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
    // Sem isto, um aparelho compartilhado (portaria, tablet de chão de
    // fábrica) continuaria mostrando os dados do tenant anterior — em
    // memória, não voltam ao mock sozinhos só porque o token sumiu.
    this.resetTenantData();
  }

  private resetTenantData(): void {
    this.pets.set([...MOCK_PETS]);
    this.teamMembers.set(restoreRoster());
    this.companyLocations.set([]);
    this.emergencyContacts.set([]);
    this.detailPetSignatures.set([]);
    this.customChecklistItems.set([]);
  }

  selectHomeTab(tab: HomeTab): void {
    this.homeTab.set(tab);
  }

  // Trilha de auditoria da PET aberta no detalhe — quem assinou, quando,
  // por qual método. Recarregada a cada abertura (inclusive depois de
  // encerrar, pra mostrar a assinatura de encerramento que acabou de
  // entrar) e limpa ao sair, pra não vazar a lista de uma PET pra outra.
  readonly detailPetSignatures = signal<WorkPermitSignature[]>([]);

  openPetDetail(id: string): void {
    this.detailPetId.set(id);
    this.screen.set('detalhe');
    this.detailPetSignatures.set([]);
    firstValueFrom(this.workPermitsApi.findSignatures(id))
      .then((signatures) => this.detailPetSignatures.set(signatures))
      .catch(() => {
        // sem sessão real ou servidor fora do ar — a tela de detalhe
        // simplesmente não mostra a trilha de auditoria nesse caso
      });
  }

  goHome(): void {
    this.screen.set('home');
  }

  // ── Assinatura eletrônica (encerramento) ──────────────────────────
  // Mesmo raciocínio do openingTimestamp da abertura: `end`/`durationMinutes`
  // precisam ficar fixos entre a assinatura e a chamada de fechamento em
  // si, senão o hash assinado não bate mais com "agora" na hora de fechar.
  readonly closingTimestamp = signal<{ end: string; durationMinutes: number } | null>(null);

  ensureClosingTimestamp(): void {
    if (this.closingTimestamp()) return;
    const id = this.detailPetId();
    const pet = this.pets().find((p) => p.id === id);
    const end = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const durationMinutes = pet ? minutesSince(pet.start) : 0;
    this.closingTimestamp.set({ end, durationMinutes });
  }

  resetClosingTimestamp(): void {
    this.closingTimestamp.set(null);
  }

  readonly closingPet = signal(false);
  readonly closingPetError = signal<string | null>(null);

  // Sem fallback local se a API falhar — mesmo raciocínio de finishPet():
  // sem uma assinatura real por trás, "fechada" na tela seria mentira. Erro
  // fica visível (closingPetError) e o técnico tenta de novo; a assinatura
  // já coletada continua válida (mesmo end/durationMinutes).
  async encerrarPet(reason: string, signatureIds: string[]): Promise<void> {
    const id = this.detailPetId();
    const timestamp = this.closingTimestamp();
    if (!id || !timestamp) return;

    this.closingPet.set(true);
    this.closingPetError.set(null);
    try {
      const closed = await firstValueFrom(
        this.workPermitsApi.close(id, {
          end: timestamp.end,
          durationMinutes: timestamp.durationMinutes,
          reason,
          signatureIds,
        }),
      );
      this.pets.update((list) => list.map((p) => (p.id === id ? closed : p)));
      this.resetClosingTimestamp();
      this.goHome();
    } catch (err) {
      this.closingPetError.set(closingPetErrorMessage(err));
    } finally {
      this.closingPet.set(false);
    }
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
    this.draftId.set(crypto.randomUUID());
    this.emitenteCoordinates.set(null);
    this.openingTimestamp.set(null);
    this.executorRegistrationOverride.set(null);
    this.finishPetError.set(null);
    this.screen.set('nova');
  }

  editArea(): void {
    const target = this.steps().indexOf('area');
    this.stepIndex.set(target === -1 ? 0 : target);
  }

  toggleArea(id: RiskAreaId): void {
    this.selectedAreas.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  /**
   * Escolher um local já cadastrado pré-preenche a área de risco (a do
   * cadastro do local, substituindo o que já estava marcado) e o nome/
   * unidade na etapa seguinte — continuam editáveis à mão depois, isto só
   * dá o ponto de partida. Ver CompanyLocation.
   */
  selectCompanyLocation(location: CompanyLocation): void {
    this.selectedAreas.set([...location.riskAreas]);
    this.setField('local', location.name);
    this.setField('unidade', location.unit);
  }

  // Primeira etapa do assistente: "cadastrar por NR" segue pro checklist
  // manual de área de risco de sempre — sem nada pré-marcado.
  chooseManualArea(): void {
    this.stepIndex.update((i) => i + 1);
  }

  /**
   * "Cadastrar por lugar de risco": pré-preenche via selectCompanyLocation()
   * e pula direto pra etapa de atividade — a área já foi decidida pelo local
   * escolhido, reapresentar o checklist manual seria redundante. O resumo da
   * etapa seguinte mostra a área escolhida com um link "Editar" pra quem
   * quiser ajustar à mão mesmo assim.
   */
  startFromCompanyLocation(location: CompanyLocation): void {
    this.selectCompanyLocation(location);
    const target = this.steps().indexOf('atividade');
    this.stepIndex.set(target === -1 ? this.stepIndex() + 1 : target);
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
    // Sem "Avançar" genérico aqui: os dois botões da etapa decidem o
    // próximo passo sozinhos (ver chooseManualArea/startFromCompanyLocation)
    // — nenhum dos dois passa pelo botão do rodapé do assistente.
    if (step === 'metodo') return false;
    if (step === 'area') return this.selectedAreas().length > 0;
    if (step === 'gases')
      return this.gasReadingComplete() && !this.atmosphereOutOfRange();
    if (step === 'check') return !this.checklistBlocked();
    if (step === 'qr') return this.authorizedTeam().length > 0;
    if (step === 'sig') return this.technicianSigned() && this.executorSigned();
    return true;
  }

  advanceStepLabel(): string {
    const steps = this.steps();
    const isLast = this.stepIndex() === steps.length - 1;
    if (isLast && this.finishingPet()) return 'Emitindo…';
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

  // Sem fallback local se a API falhar (ao contrário de outros cadastros
  // deste serviço): as duas assinaturas eletrônicas só existem de verdade
  // no servidor, então fabricar uma PET local aqui criaria uma permissão
  // "emitida" sem nenhuma assinatura real por trás dela — exatamente o
  // problema que esta feature existe para resolver. Erro fica visível
  // (finishPetError) e o técnico tenta de novo; as assinaturas já
  // coletadas continuam válidas (mesmo draftId).
  private async finishPet(): Promise<void> {
    this.ensureOpeningTimestamp();
    const snapshot = this.openingContentSnapshot();
    // O tipo do computed é deliberadamente solto (Record<string, unknown> —
    // ver openingContentSnapshot()): é o mesmo objeto usado pra montar o
    // hash assinado, então o formato precisa seguir exatamente o que o
    // back-end recompõe, não a interface estrita da API.
    const payload = {
      ...snapshot,
      draftId: this.draftId(),
      coordinates: this.emitenteCoordinates() ?? undefined,
    } as unknown as CreateWorkPermitPayload;

    this.finishingPet.set(true);
    this.finishPetError.set(null);
    let pet: Pet;
    try {
      pet = await firstValueFrom(this.workPermitsApi.create(payload));
    } catch (err) {
      this.finishPetError.set(finishPetErrorMessage(err));
      if ((err as { status?: number })?.status === 409) {
        // Conteúdo mudou depois de assinado — força reassinatura com um
        // draftId novo em vez de deixar o técnico reenviar contra
        // assinaturas que o back-end já considera inválidas para este
        // conteúdo.
        this.technicianSigned.set(false);
        this.executorSigned.set(false);
        this.draftId.set(crypto.randomUUID());
      }
      return;
    } finally {
      this.finishingPet.set(false);
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

/**
 * Por que a PET não foi emitida, na linguagem de quem está em campo.
 *
 * 409 é o back-end recusando porque o conteúdo mudou depois de assinado
 * (ver WorkPermitSignaturesService.requireDraftSignatures) — as duas
 * assinaturas já coletadas ficam inválidas para este conteúdo, por isso
 * finishPet() já zera technicianSigned/executorSigned e gera um draftId
 * novo antes de mostrar esta mensagem.
 */
function finishPetErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 409) {
    return 'O conteúdo da PET mudou depois de assinado — assine de novo e emita outra vez.';
  }
  if (status === 400) {
    const body = (err as { error?: { message?: unknown } })?.error;
    if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    return 'Faltou concluir alguma assinatura antes de emitir a PET.';
  }
  if (status === 0 || status === undefined || status >= 502) {
    return 'Servidor indisponível: a PET não foi emitida. As assinaturas já coletadas continuam válidas — tente de novo quando a conexão voltar.';
  }
  if (status === 401) {
    return 'Sua sessão expirou. Entre de novo com e-mail e senha para continuar.';
  }
  return 'Não foi possível emitir a PET agora. Tente novamente.';
}

/** Mesmo raciocínio de finishPetErrorMessage(), para o encerramento. */
function closingPetErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 409) {
    return 'O conteúdo do encerramento mudou depois de assinado — assine de novo.';
  }
  if (status === 400) {
    const body = (err as { error?: { message?: unknown } })?.error;
    if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    return 'Assine o encerramento antes de confirmar.';
  }
  if (status === 0 || status === undefined || status >= 502) {
    return 'Servidor indisponível: a PET não foi encerrada. A assinatura já coletada continua válida — tente de novo quando a conexão voltar.';
  }
  if (status === 401) {
    return 'Sua sessão expirou. Entre de novo com e-mail e senha para continuar.';
  }
  return 'Não foi possível encerrar a PET agora. Tente novamente.';
}
