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
 * vê essa aba (ver PetShellComponent.navItems). Sem back-end de exclusão
 * nesta fase: um tenant, uma vez criado, não some — só se cadastra mais.
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
}
