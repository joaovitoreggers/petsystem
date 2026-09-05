import { Component, computed, signal } from '@angular/core';
import { PetStateService } from '../pet-state.service';
import {
  BADGE_STATUS,
  BadgeItemStatus,
  DOCUMENT_TYPES,
  TeamMember,
  dateToBr,
  daysUntil,
} from '../pet-mock-data';

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

const TEAM_FILTERS: TeamFilter[] = ['todos', 'vencimento próximo', 'vencidos', 'terceiros'];

function documentStatus(days: number): BadgeItemStatus {
  if (days < 0) return 'venc';
  if (days <= 30) return 'prox';
  return 'ok';
}

@Component({
  selector: 'app-pet-team',
  standalone: true,
  imports: [],
  templateUrl: './pet-team.component.html',
  styleUrl: './pet-team.component.scss',
})
export class PetTeamComponent {
  readonly filters = TEAM_FILTERS;
  readonly documentTypes = DOCUMENT_TYPES;

  readonly filter = signal<TeamFilter>('todos');
  readonly modalOpen = signal(false);

  readonly cadName = signal('');
  readonly cadRegistration = signal('');
  readonly cadRole = signal('');
  readonly cadCompany = signal('Lar · Manutenção');
  readonly cadUnit = signal('Matelândia');
  readonly cadVinculo = signal<'Próprio' | 'Terceiro'>('Próprio');
  readonly cadDocDates = signal<Record<string, string>>({ ASO: '' });

  constructor(readonly state: PetStateService) {}

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
          deadlineLabel: days < 0 ? `vencido há ${-days} d` : days === 0 ? 'vence hoje' : `em ${days} d`,
        };
      })
      .sort((a, b) => a.days - b.days);

    const status: BadgeItemStatus = documents.some((d) => d.status === 'venc')
      ? 'venc'
      : documents.some((d) => d.status === 'prox')
        ? 'prox'
        : 'ok';
    const next = documents[0];
    const situationLabel = status === 'venc' ? 'entrada bloqueada' : status === 'prox' ? 'renovação próxima' : 'apto';

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
      situationFg: status === 'venc' ? '#fdf3f3' : status === 'prox' ? '#6b4600' : '#1d4d33',
      situationBg: status === 'venc' ? 'var(--status-bad)' : status === 'prox' ? '#f6e6c4' : '#dff0e6',
      rowBg: status === 'venc' ? '#f9eded' : 'transparent',
    };
  }

  readonly allMembers = computed<TeamMemberView[]>(() => {
    const views = this.state.teamMembers().map((m) => this.toView(m));
    const rank = (s: BadgeItemStatus) => (s === 'venc' ? 0 : s === 'prox' ? 1 : 2);
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
      { label: 'Cadastrados', value: String(s.total), note: `${s.thirdParty} de empresas terceiras`, color: 'var(--color-text)' },
      { label: 'Aptos sem pendência', value: String(s.ok), note: 'toda a documentação em dia', color: 'var(--color-text)' },
      { label: 'Vencimento em 30 dias', value: String(s.prox), note: 'renovação a programar', color: '#8a5a00' },
      { label: 'Entrada bloqueada', value: String(s.venc), note: 'documentação vencida', color: 'var(--status-bad)' },
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
        deadlineLabel: !checked ? '' : !iso ? 'sem data' : days! < 0 ? 'vencido' : `em ${days} d`,
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
    else if (codes.some((c) => !dates[c])) missing.push('a validade dos documentos marcados');
    return missing;
  });

  readonly cadSummary = computed(() => {
    const missing = this.cadMissing();
    if (missing.length > 0) return `Falta preencher: ${missing.join(', ')}.`;
    return `Pronto para cadastrar · ${Object.keys(this.cadDocDates()).length} documentos com validade registrada.`;
  });

  readonly cadDisabled = computed(() => this.cadMissing().length > 0);

  save(): void {
    if (this.cadDisabled()) return;
    const documents: Record<string, string> = {};
    const dates = this.cadDocDates();
    for (const code of Object.keys(dates)) {
      if (dates[code]) documents[code] = dates[code];
    }
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
    this.cadUnit.set('Matelândia');
    this.cadVinculo.set('Próprio');
    this.cadDocDates.set({ ASO: '' });
  }
}
