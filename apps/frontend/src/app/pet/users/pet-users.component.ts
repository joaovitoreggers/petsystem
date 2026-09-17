import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PetStateService } from '../pet-state.service';
import {
  CreateUserPayload,
  SystemUser,
  UpdateUserPayload,
  UsersApiService,
} from '../services/users-api.service';
import { Branch, CompanyGroup, TenancyApiService } from '../services/tenancy-api.service';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';

export const ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acesso total, inclusive gestão de usuários',
  },
  {
    value: 'gestor',
    label: 'Gestor',
    description: 'Painel de gestão e cadastro de funcionários',
  },
  {
    value: 'tecnico',
    label: 'Técnico',
    description: 'Emissão e acompanhamento de PET em campo',
  },
];

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

@Component({
  selector: 'app-pet-users',
  standalone: true,
  imports: [IconComponent, IndustrialArtComponent],
  templateUrl: './pet-users.component.html',
  styleUrl: './pet-users.component.scss',
})
export class PetUsersComponent implements OnInit {
  readonly roleOptions = ROLE_OPTIONS;

  readonly users = signal<SystemUser[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly modalOpen = signal(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly formName = signal('');
  readonly formEmail = signal('');
  readonly formPassword = signal('');
  readonly formRole = signal('tecnico');
  // '' = sem filial (enxerga todas as filiais do grupo).
  readonly formBranchId = signal('');
  // Só usado quando quem está logado é platform-admin (sem grupo próprio) —
  // admin/gestor sempre cadastram dentro do próprio grupo, sem escolher.
  readonly formCompanyGroupId = signal('');

  readonly deleteTarget = signal<SystemUser | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  // Grupos (só carregados/usados para platform-admin) e filiais do grupo
  // relevante — o próprio, ou o escolhido no select acima.
  readonly groups = signal<CompanyGroup[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly branchesLoading = signal(false);

  constructor(
    readonly state: PetStateService,
    private readonly usersApi: UsersApiService,
    private readonly tenancyApi: TenancyApiService,
  ) {
    if (this.state.isPlatformAdmin()) {
      this.loadGroups();
    }
    effect(() => {
      const groupId = this.state.isPlatformAdmin()
        ? this.formCompanyGroupId()
        : this.state.session()?.user.companyGroupId;
      this.loadBranches(groupId || null);
    });
  }

  /**
   * A industria de quem esta cadastrando, quando ela tem uma.
   *
   * Um administrador lotado em Ceu Azul cria contas de Ceu Azul — nao ha
   * escolha a fazer, entao nao ha seletor. O servidor aplica a mesma regra
   * (ver UsersService.resolveTenancy): o branchId enviado por uma sessao
   * presa a uma industria e ignorado de proposito.
   */
  readonly unidadeFixa = computed(() => this.state.currentBranchName());

  /** A indústria escolhida no formulário, pelo nome. */
  readonly industriaEscolhida = computed(() => {
    const fixa = this.unidadeFixa();
    if (fixa) return fixa;
    const id = this.formBranchId();
    return id ? (this.branches().find((b) => b.id === id)?.name ?? null) : null;
  });

  /**
   * O que a conta vai ser, em uma frase.
   *
   * Papel e indústria são dois campos, mas uma decisão só: "Administrador de
   * Céu Azul" não é a mesma coisa que "Administrador" e "Céu Azul" lidos
   * separados, e é fácil escolher o papel e esquecer a indústria. A frase
   * fecha o combinado antes de salvar.
   */
  readonly resumoDoCadastro = computed(() => {
    const papel = roleLabel(this.formRole());
    const industria = this.industriaEscolhida();
    return industria
      ? `${papel} de ${industria}`
      : `${papel} de todas as indústrias do grupo`;
  });

  ngOnInit(): void {
    this.reload();
  }

  private async loadGroups(): Promise<void> {
    try {
      this.groups.set(await firstValueFrom(this.tenancyApi.findGroups()));
    } catch {
      // sem grupos disponíveis — o select fica vazio, o form acusa ao salvar
    }
  }

  private async loadBranches(groupId: string | null): Promise<void> {
    if (!groupId) {
      this.branches.set([]);
      return;
    }
    this.branchesLoading.set(true);
    try {
      const branches = await firstValueFrom(this.tenancyApi.findBranches(groupId));
      this.branches.set(branches.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      this.branches.set([]);
    } finally {
      this.branchesLoading.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const users = await firstValueFrom(this.usersApi.findAll());
      this.users.set(users.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      this.loadError.set('Não foi possível carregar os usuários.');
    } finally {
      this.loading.set(false);
    }
  }

  readonly rows = computed(() =>
    this.users().map((user) => ({
      user,
      roleLabel: roleLabel(user.role),
      branchLabel: this.branchName(user.branchId),
      isSelf: user.id === this.state.session()?.user.id,
    })),
  );

  private branchName(branchId: string | null): string {
    if (!branchId) return 'Todas as indústrias';
    return this.branches().find((b) => b.id === branchId)?.name ?? '—';
  }

  readonly dialogTitle = computed(() =>
    this.dialogMode() === 'edit' ? 'Editar usuário' : 'Cadastrar usuário',
  );
  readonly dialogActionLabel = computed(() =>
    this.saving() ? 'Salvando…' : this.dialogMode() === 'edit' ? 'Salvar alterações' : 'Cadastrar usuário',
  );

  readonly formMissing = computed(() => {
    const missing: string[] = [];
    if (!this.formName().trim()) missing.push('nome');
    if (!this.formEmail().trim()) missing.push('e-mail');
    if (this.dialogMode() === 'create' && this.formPassword().trim().length < 6) {
      missing.push('senha de ao menos 6 caracteres');
    }
    if (
      this.dialogMode() === 'edit' &&
      this.formPassword().trim().length > 0 &&
      this.formPassword().trim().length < 6
    ) {
      missing.push('a nova senha precisa de ao menos 6 caracteres');
    }
    if (this.state.isPlatformAdmin() && !this.formCompanyGroupId()) {
      missing.push('grupo de empresas');
    }
    return missing;
  });

  readonly formDisabled = computed(() => this.formMissing().length > 0 || this.saving());

  openCreateModal(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.saveError.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.formRole.set('tecnico');
    this.formBranchId.set('');
    this.formCompanyGroupId.set('');
    this.modalOpen.set(true);
  }

  openEditModal(user: SystemUser): void {
    this.dialogMode.set('edit');
    this.editingId.set(user.id);
    this.saveError.set(null);
    this.formName.set(user.name);
    this.formEmail.set(user.email);
    this.formPassword.set('');
    this.formRole.set(user.role);
    this.formBranchId.set(user.branchId ?? '');
    this.formCompanyGroupId.set(user.companyGroupId ?? '');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  async save(): Promise<void> {
    if (this.formDisabled()) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const companyGroupId = this.state.isPlatformAdmin()
        ? this.formCompanyGroupId() || undefined
        : undefined;
      if (this.dialogMode() === 'edit') {
        const id = this.editingId();
        if (!id) return;
        const patch: UpdateUserPayload = {
          name: this.formName().trim(),
          email: this.formEmail().trim(),
          role: this.formRole(),
          // Sempre explícito na edição: '' precisa virar `null` (limpar a
          // filial) e não `undefined` (que o back-end lê como "não mexer").
          branchId: this.formBranchId() || null,
          companyGroupId,
        };
        if (this.formPassword().trim()) patch.password = this.formPassword().trim();
        const updated = await firstValueFrom(this.usersApi.update(id, patch));
        this.users.update((list) =>
          list.map((u) => (u.id === id ? updated : u)).sort((a, b) => a.name.localeCompare(b.name)),
        );
      } else {
        const payload: CreateUserPayload = {
          name: this.formName().trim(),
          email: this.formEmail().trim(),
          password: this.formPassword().trim(),
          role: this.formRole(),
          branchId: this.formBranchId() || undefined,
          companyGroupId,
        };
        const created = await firstValueFrom(this.usersApi.create(payload));
        this.users.update((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      this.modalOpen.set(false);
    } catch (err) {
      this.saveError.set(extractErrorMessage(err, 'Não foi possível salvar o usuário.'));
    } finally {
      this.saving.set(false);
    }
  }

  openDeleteDialog(user: SystemUser): void {
    this.deleteTarget.set(user);
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
      await firstValueFrom(this.usersApi.remove(target.id));
      this.users.update((list) => list.filter((u) => u.id !== target.id));
      this.deleteTarget.set(null);
    } catch (err) {
      this.deleteError.set(extractErrorMessage(err, 'Não foi possível excluir o usuário.'));
    } finally {
      this.deleting.set(false);
    }
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { message?: string | string[] } }).error;
    const message = body?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
  }
  return fallback;
}
