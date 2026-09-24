import { Component, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as QRCode from 'qrcode';
import { PetStateService } from '../pet-state.service';
import {
  BADGE_STATUS,
  BadgeItemStatus,
  DOCUMENT_TYPES,
  TeamMember,
  dateToBr,
  daysUntil,
  encodeBadgeQr,
} from '../pet-mock-data';
import { TenancyApiService } from '../services/tenancy-api.service';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';

const FALLBACK_UNITS = ['Matelândia', 'Medianeira', 'Céu Azul', 'Itaipulândia', 'Missal'];

type TeamFilter = 'todos' | 'vencimento próximo' | 'vencidos' | 'terceiros';

interface DocumentView {
  code: string;
  iso: string;
  days: number;
  status: BadgeItemStatus;
  color: string;
  icon: string;
  dateLabel: string;
  deadlineLabel: string;
}

interface TeamMemberView {
  member: TeamMember;
  initials: string;
  vinculo: string;
  documents: DocumentView[];
  status: BadgeItemStatus;
  nextDocLabel: string;
  nextDeadlineLabel: string;
  nextDeadlineColor: string;
  situationLabel: string;
  situationFg: string;
  situationBg: string;
  rowBg: string;
}

interface CadastroDocView {
  code: string;
  description: string;
  checked: boolean;
  iso: string;
  color: string;
  deadlineLabel: string;
}

const TEAM_FILTERS: TeamFilter[] = [
  'todos',
  'vencimento próximo',
  'vencidos',
  'terceiros',
];

function documentStatus(days: number): BadgeItemStatus {
  if (days < 0) return 'venc';
  if (days <= 30) return 'prox';
  return 'ok';
}

@Component({
  selector: 'app-pet-team',
  standalone: true,
  imports: [IconComponent, IndustrialArtComponent],
  templateUrl: './pet-team.component.html',
  styleUrl: './pet-team.component.scss',
})
export class PetTeamComponent {
  readonly filters = TEAM_FILTERS;
  readonly documentTypes = DOCUMENT_TYPES;

  readonly filter = signal<TeamFilter>('todos');
  readonly modalOpen = signal(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly editingRegistration = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly cadName = signal('');
  readonly cadRegistration = signal('');
  readonly cadRole = signal('');
  readonly cadCompany = signal('Lar · Manutenção');
  readonly cadUnit = signal('Matelândia');
  readonly cadVinculo = signal<'Próprio' | 'Terceiro'>('Próprio');
  readonly cadDocDates = signal<Record<string, string>>({ ASO: '' });

  readonly deleteTarget = signal<TeamMember | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  // Crachá em QR — gerado aqui, lido pela câmera na etapa "Crachá e
  // permissão" do assistente (ver PetWizardComponent.startQrScan /
  // decodeBadgeQr em pet-mock-data.ts).
  readonly qrTarget = signal<TeamMember | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  readonly qrError = signal<string | null>(null);

  // Lista de unidades do seletor "Unidade" — mesma lógica de fallback do
  // assistente "Nova PET" (ver PetWizardComponent): mock por padrão, troca
  // pelas filiais reais do grupo assim que carregam.
  readonly unitOptions = signal<string[]>(FALLBACK_UNITS);

  constructor(
    readonly state: PetStateService,
    private readonly tenancyApi: TenancyApiService,
  ) {
    const companyGroupId = this.state.session()?.user.companyGroupId;
    if (companyGroupId) {
      this.loadBranchNames(companyGroupId);
    }
  }

  private async loadBranchNames(companyGroupId: string): Promise<void> {
    try {
      const branches = await firstValueFrom(this.tenancyApi.findBranches(companyGroupId));
      if (branches.length > 0) {
        this.unitOptions.set(branches.map((b) => b.name).sort((a, b) => a.localeCompare(b)));
      }
    } catch {
      // mantém FALLBACK_UNITS
    }
  }

  private toView(member: TeamMember): TeamMemberView {
    const documents: DocumentView[] = Object.keys(member.documents)
      .map((code) => {
        const iso = member.documents[code];
        const days = daysUntil(iso);
        const status = documentStatus(days);
        return {
          code,
          iso,
          days,
          status,
          color: BADGE_STATUS[status].color,
          icon: BADGE_STATUS[status].icon,
          dateLabel: dateToBr(iso),
          deadlineLabel:
            days < 0
              ? `vencido há ${-days} d`
              : days === 0
                ? 'vence hoje'
                : `em ${days} d`,
        };
      })
      .sort((a, b) => a.days - b.days);

    const status: BadgeItemStatus = documents.some((d) => d.status === 'venc')
      ? 'venc'
      : documents.some((d) => d.status === 'prox')
        ? 'prox'
        : 'ok';
    const next = documents[0];
    const situationLabel =
      status === 'venc'
        ? 'acesso crítico'
        : status === 'prox'
          ? 'renovação próxima'
          : 'apto';

    return {
      member,
      initials: member.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join(''),
      vinculo: member.isThirdParty ? 'terceiro' : 'próprio',
      documents,
      status,
      nextDocLabel: next ? `${next.code} · ${next.dateLabel}` : '—',
      nextDeadlineLabel: next?.deadlineLabel ?? '',
      nextDeadlineColor: next ? next.color : 'var(--color-text)',
      situationLabel,
      situationFg:
        status === 'venc'
          ? '#fdf3f3'
          : status === 'prox'
            ? '#6b4600'
            : '#1d4d33',
      situationBg:
        status === 'venc'
          ? 'var(--status-bad)'
          : status === 'prox'
            ? '#f6e6c4'
            : '#dff0e6',
      rowBg: status === 'venc' ? '#f9eded' : 'transparent',
    };
  }

  readonly allMembers = computed<TeamMemberView[]>(() => {
    const views = this.state.teamMembers().map((m) => this.toView(m));
    const rank = (s: BadgeItemStatus) =>
      s === 'venc' ? 0 : s === 'prox' ? 1 : 2;
    return views.sort((a, b) => rank(a.status) - rank(b.status));
  });

  readonly stats = computed(() => {
    const members = this.allMembers();
    return {
      total: members.length,
      thirdParty: members.filter((m) => m.member.isThirdParty).length,
      ok: members.filter((m) => m.status === 'ok').length,
      prox: members.filter((m) => m.status === 'prox').length,
      venc: members.filter((m) => m.status === 'venc').length,
    };
  });

  readonly kpis = computed(() => {
    const s = this.stats();
    return [
      {
        label: 'Cadastrados',
        value: String(s.total),
        note: `${s.thirdParty} de empresas terceiras`,
        color: 'var(--color-text)',
      },
      {
        label: 'Aptos sem pendência',
        value: String(s.ok),
        note: 'toda a documentação em dia',
        color: 'var(--color-text)',
      },
      {
        label: 'Vencimento em 30 dias',
        value: String(s.prox),
        note: 'renovação a programar',
        color: '#8a5a00',
      },
      {
        label: 'Acesso crítico',
        value: String(s.venc),
        note: 'documentação vencida',
        color: 'var(--status-bad)',
      },
    ];
  });

  readonly filteredMembers = computed(() => {
    const filter = this.filter();
    return this.allMembers().filter((m) => {
      if (filter === 'todos') return true;
      if (filter === 'vencidos') return m.status === 'venc';
      if (filter === 'vencimento próximo') return m.status === 'prox';
      return m.member.isThirdParty === true;
    });
  });

  setFilter(filter: TeamFilter): void {
    this.filter.set(filter);
  }

  openModal(): void {
    this.dialogMode.set('create');
    this.editingRegistration.set(null);
    this.saveError.set(null);
    this.cadName.set('');
    this.cadRegistration.set('');
    this.cadRole.set('');
    this.cadCompany.set('Lar · Manutenção');
    this.cadUnit.set(this.unitOptions()[0] ?? 'Matelândia');
    this.cadVinculo.set('Próprio');
    this.cadDocDates.set({ ASO: '' });
    this.modalOpen.set(true);
  }

  openEditModal(member: TeamMember): void {
    this.dialogMode.set('edit');
    this.editingRegistration.set(member.registration);
    this.saveError.set(null);
    this.cadName.set(member.name);
    this.cadRegistration.set(member.registration);
    this.cadRole.set(member.role);
    this.cadCompany.set(member.company);
    this.cadUnit.set(member.unit);
    this.cadVinculo.set(member.isThirdParty ? 'Terceiro' : 'Próprio');
    this.cadDocDates.set({ ...member.documents });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  readonly cadDocs = computed<CadastroDocView[]>(() =>
    this.documentTypes.map((type) => {
      const dates = this.cadDocDates();
      const checked = type.code in dates;
      const iso = dates[type.code] ?? '';
      const days = iso ? daysUntil(iso) : null;
      const status = days === null ? 'ok' : documentStatus(days);
      return {
        code: type.code,
        description: type.description,
        checked,
        iso,
        color: !iso ? 'var(--color-neutral-600)' : BADGE_STATUS[status].color,
        deadlineLabel: !checked
          ? ''
          : !iso
            ? 'sem data'
            : days! < 0
              ? 'vencido'
              : `em ${days} d`,
      };
    }),
  );

  toggleCadDoc(code: string): void {
    this.cadDocDates.update((dates) => {
      const next = { ...dates };
      if (code in next) delete next[code];
      else next[code] = '';
      return next;
    });
  }

  setCadDocDate(code: string, iso: string): void {
    this.cadDocDates.update((dates) => ({ ...dates, [code]: iso }));
  }

  readonly cadMissing = computed(() => {
    const missing: string[] = [];
    if (!this.cadName().trim()) missing.push('nome');
    if (!this.cadRegistration().trim()) missing.push('matrícula');
    if (!this.cadRole().trim()) missing.push('função');
    const dates = this.cadDocDates();
    const codes = Object.keys(dates);
    if (codes.length === 0) missing.push('ao menos um documento');
    else if (codes.some((c) => !dates[c]))
      missing.push('a validade dos documentos marcados');
    return missing;
  });

  readonly cadSummary = computed(() => {
    const missing = this.cadMissing();
    if (missing.length > 0) return `Falta preencher: ${missing.join(', ')}.`;
    const count = Object.keys(this.cadDocDates()).length;
    return this.dialogMode() === 'edit'
      ? `Pronto para salvar · ${count} documentos com validade registrada.`
      : `Pronto para cadastrar · ${count} documentos com validade registrada.`;
  });

  readonly cadDisabled = computed(() => this.cadMissing().length > 0 || this.saving());

  readonly dialogTitle = computed(() =>
    this.dialogMode() === 'edit' ? 'Editar funcionário' : 'Cadastrar funcionário',
  );
  readonly dialogActionLabel = computed(() =>
    this.saving() ? 'Salvando…' : this.dialogMode() === 'edit' ? 'Salvar alterações' : 'Cadastrar e gerar QR',
  );

  async save(): Promise<void> {
    if (this.cadDisabled()) return;
    const documents: Record<string, string> = {};
    const dates = this.cadDocDates();
    for (const code of Object.keys(dates)) {
      if (dates[code]) documents[code] = dates[code];
    }

    if (this.dialogMode() === 'edit') {
      const registration = this.editingRegistration();
      if (!registration) return;
      this.saving.set(true);
      this.saveError.set(null);
      try {
        await this.state.updateTeamMember(registration, {
          name: this.cadName().trim(),
          role: this.cadRole().trim(),
          company: this.cadCompany().trim(),
          unit: this.cadUnit(),
          isThirdParty: this.cadVinculo() === 'Terceiro',
          documents,
        });
        this.modalOpen.set(false);
      } catch (err) {
        this.saveError.set(teamErrorMessage(err, 'salvar'));
      } finally {
        this.saving.set(false);
      }
      return;
    }

    this.createMember(documents);
  }

  private createMember(documents: Record<string, string>): void {
    this.state.registerTeamMember({
      name: this.cadName().trim(),
      registration: this.cadRegistration().trim(),
      role: this.cadRole().trim(),
      company: this.cadCompany().trim(),
      unit: this.cadUnit(),
      isThirdParty: this.cadVinculo() === 'Terceiro',
      documents,
    });
    this.modalOpen.set(false);
    this.filter.set('todos');
    this.cadName.set('');
    this.cadRegistration.set('');
    this.cadRole.set('');
    this.cadCompany.set('Lar · Manutenção');
    this.cadUnit.set(this.unitOptions()[0] ?? 'Matelândia');
    this.cadVinculo.set('Próprio');
    this.cadDocDates.set({ ASO: '' });
  }

  openDeleteDialog(member: TeamMember): void {
    this.deleteTarget.set(member);
    this.deleteError.set(null);
  }

  closeDeleteDialog(): void {
    this.deleteTarget.set(null);
  }

  async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.state.deleteTeamMember(target.registration);
      this.deleteTarget.set(null);
    } catch (err) {
      this.deleteError.set(teamErrorMessage(err, 'excluir'));
    } finally {
      this.deleting.set(false);
    }
  }

  async openQrDialog(member: TeamMember): Promise<void> {
    this.qrTarget.set(member);
    this.qrDataUrl.set(null);
    this.qrError.set(null);
    try {
      const dataUrl = await QRCode.toDataURL(encodeBadgeQr(member.registration), {
        width: 320,
        margin: 2,
      });
      this.qrDataUrl.set(dataUrl);
    } catch {
      this.qrError.set('Não foi possível gerar o QR code agora. Tente de novo.');
    }
  }

  closeQrDialog(): void {
    this.qrTarget.set(null);
  }

  downloadQr(): void {
    const dataUrl = this.qrDataUrl();
    const member = this.qrTarget();
    if (!dataUrl || !member) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `crachá-${member.registration}.png`;
    link.click();
  }
}

/**
 * Por que a alteração do cadastro não foi gravada, na linguagem de quem está
 * na tela.
 *
 * A mensagem anterior culpava a autenticação em qualquer falha. Com o
 * servidor fora do ar — o caso mais comum — ela mandava o usuário conferir a
 * senha, que está certa, e escondia o motivo real. Cada causa exige uma ação
 * diferente de quem está ali: reentrar, chamar quem tem alçada, ou esperar o
 * servidor voltar.
 */
function teamErrorMessage(err: unknown, acao: 'salvar' | 'excluir'): string {
  const status = (err as { status?: number })?.status;

  // status 0 é o navegador não ter conseguido falar com ninguém; 502/503/504
  // é o proxy respondendo que o back-end não respondeu.
  if (status === 0 || status === undefined || status >= 502) {
    return `Servidor indisponível: a alteração não foi gravada. Nada mudou no cadastro — tente de novo quando a conexão voltar.`;
  }
  if (status === 401) {
    return 'Sua sessão expirou. Entre de novo com e-mail e senha para continuar.';
  }
  if (status === 403) {
    return `Seu perfil não tem alçada para ${acao} funcionários. Procure o SESMT.`;
  }
  if (status === 404) {
    return 'Este funcionário não existe mais no cadastro — atualize a lista.';
  }
  if (status === 409) {
    const body = (err as { error?: { message?: unknown } })?.error;
    return typeof body?.message === 'string'
      ? body.message
      : 'Não foi possível concluir: o funcionário está vinculado a outro registro.';
  }
  if (status === 400) {
    return 'Confira os campos: algum valor não foi aceito pelo servidor.';
  }
  return `Não foi possível ${acao} agora. Tente novamente.`;
}
