import { Component, OnInit, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Branch, CompanyGroup, TenancyApiService } from '../services/tenancy-api.service';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { message?: string | string[] } }).error;
    const message = body?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
  }
  return fallback;
}

/**
 * Gestão de grupos de empresas (tenants) e suas filiais — só platform-admin
 * vê essa aba (ver PetShellComponent.navItems). Excluir um grupo/filial
 * ainda vinculado a algo (filial, usuário, PET, funcionário) devolve 409 —
 * ver CompanyGroupsService/BranchesService no back-end.
 */
@Component({
  selector: 'app-pet-companies',
  standalone: true,
  imports: [IconComponent, IndustrialArtComponent],
  templateUrl: './pet-companies.component.html',
  styleUrl: './pet-companies.component.scss',
})
export class PetCompaniesComponent implements OnInit {
  readonly groups = signal<CompanyGroup[]>([]);
  readonly loadingGroups = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly selectedGroupId = signal<string | null>(null);
  readonly branches = signal<Branch[]>([]);
  readonly loadingBranches = signal(false);

  readonly newGroupName = signal('');
  readonly creatingGroup = signal(false);
  readonly groupError = signal<string | null>(null);

  readonly newBranchName = signal('');
  readonly creatingBranch = signal(false);
  readonly branchError = signal<string | null>(null);

  readonly selectedGroup = computed(() =>
    this.groups().find((g) => g.id === this.selectedGroupId()) ?? null,
  );

  // Renomear grupo/filial — um diálogo simples só com o campo nome,
  // reaproveitando as mesmas classes .dialog do resto do app.
  readonly renameTarget = signal<{ kind: 'group' | 'branch'; id: string; name: string } | null>(null);
  readonly renameValue = signal('');
  readonly renaming = signal(false);
  readonly renameError = signal<string | null>(null);

  // Excluir grupo/filial — confirmação com o erro de "ainda vinculado"
  // (409) exibido igual a qualquer outro erro de formulário.
  readonly deleteTarget = signal<{ kind: 'group' | 'branch'; id: string; name: string } | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  constructor(private readonly tenancyApi: TenancyApiService) {}

  ngOnInit(): void {
    this.reloadGroups();
  }

  private async reloadGroups(): Promise<void> {
    this.loadingGroups.set(true);
    this.loadError.set(null);
    try {
      const groups = await firstValueFrom(this.tenancyApi.findGroups());
      this.groups.set(groups.sort((a, b) => a.name.localeCompare(b.name)));
      if (!this.selectedGroupId() && groups.length > 0) {
        this.selectGroup(groups[0].id);
      }
    } catch {
      this.loadError.set('Não foi possível carregar os grupos de empresas.');
    } finally {
      this.loadingGroups.set(false);
    }
  }

  selectGroup(groupId: string): void {
    this.selectedGroupId.set(groupId);
    this.branchError.set(null);
    this.reloadBranches(groupId);
  }

  private async reloadBranches(groupId: string): Promise<void> {
    this.loadingBranches.set(true);
    try {
      const branches = await firstValueFrom(this.tenancyApi.findBranches(groupId));
      this.branches.set(branches.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      this.branches.set([]);
    } finally {
      this.loadingBranches.set(false);
    }
  }

  async createGroup(): Promise<void> {
    const name = this.newGroupName().trim();
    if (!name || this.creatingGroup()) return;
    this.creatingGroup.set(true);
    this.groupError.set(null);
    try {
      const created = await firstValueFrom(this.tenancyApi.createGroup(name));
      this.groups.update((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      this.newGroupName.set('');
      this.selectGroup(created.id);
    } catch (err) {
      this.groupError.set(extractErrorMessage(err, 'Não foi possível criar o grupo de empresas.'));
    } finally {
      this.creatingGroup.set(false);
    }
  }

  async createBranch(): Promise<void> {
    const groupId = this.selectedGroupId();
    const name = this.newBranchName().trim();
    if (!groupId || !name || this.creatingBranch()) return;
    this.creatingBranch.set(true);
    this.branchError.set(null);
    try {
      const created = await firstValueFrom(this.tenancyApi.createBranch(groupId, name));
      this.branches.update((list) =>
        [...list, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.newBranchName.set('');
    } catch (err) {
      this.branchError.set(extractErrorMessage(err, 'Não foi possível criar a filial.'));
    } finally {
      this.creatingBranch.set(false);
    }
  }

  // ── Renomear ──────────────────────────────────────────────────────────

  openRenameGroup(group: CompanyGroup): void {
    this.renameTarget.set({ kind: 'group', id: group.id, name: group.name });
    this.renameValue.set(group.name);
    this.renameError.set(null);
  }

  openRenameBranch(branch: Branch): void {
    this.renameTarget.set({ kind: 'branch', id: branch.id, name: branch.name });
    this.renameValue.set(branch.name);
    this.renameError.set(null);
  }

  closeRename(): void {
    this.renameTarget.set(null);
  }

  async confirmRename(): Promise<void> {
    const target = this.renameTarget();
    const name = this.renameValue().trim();
    if (!target || !name || this.renaming()) return;
    this.renaming.set(true);
    this.renameError.set(null);
    try {
      if (target.kind === 'group') {
        const updated = await firstValueFrom(this.tenancyApi.renameGroup(target.id, name));
        this.groups.update((list) =>
          list.map((g) => (g.id === target.id ? updated : g)).sort((a, b) => a.name.localeCompare(b.name)),
        );
      } else {
        const groupId = this.selectedGroupId();
        if (!groupId) return;
        const updated = await firstValueFrom(this.tenancyApi.renameBranch(groupId, target.id, name));
        this.branches.update((list) =>
          list.map((b) => (b.id === target.id ? updated : b)).sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      this.renameTarget.set(null);
    } catch (err) {
      this.renameError.set(extractErrorMessage(err, 'Não foi possível renomear.'));
    } finally {
      this.renaming.set(false);
    }
  }

  // ── Excluir ───────────────────────────────────────────────────────────

  openDeleteGroup(group: CompanyGroup): void {
    this.deleteTarget.set({ kind: 'group', id: group.id, name: group.name });
    this.deleteError.set(null);
  }

  openDeleteBranch(branch: Branch): void {
    this.deleteTarget.set({ kind: 'branch', id: branch.id, name: branch.name });
    this.deleteError.set(null);
  }

  closeDeleteDialog(): void {
    this.deleteTarget.set(null);
  }

  async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      if (target.kind === 'group') {
        await firstValueFrom(this.tenancyApi.deleteGroup(target.id));
        this.groups.update((list) => list.filter((g) => g.id !== target.id));
        if (this.selectedGroupId() === target.id) {
          this.selectedGroupId.set(null);
          this.branches.set([]);
          const remaining = this.groups();
          if (remaining.length > 0) this.selectGroup(remaining[0].id);
        }
      } else {
        const groupId = this.selectedGroupId();
        if (!groupId) return;
        await firstValueFrom(this.tenancyApi.deleteBranch(groupId, target.id));
        this.branches.update((list) => list.filter((b) => b.id !== target.id));
      }
      this.deleteTarget.set(null);
    } catch (err) {
      this.deleteError.set(
        extractErrorMessage(
          err,
          target.kind === 'group' ? 'Não foi possível excluir o grupo.' : 'Não foi possível excluir a filial.',
        ),
      );
    } finally {
      this.deleting.set(false);
    }
  }
}
