import { Component, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PetStateService } from '../pet-state.service';
import { CompanyLocation, RISK_AREAS, RiskAreaId, riskAreaName, riskAreaNr } from '../pet-mock-data';
import { TenancyApiService } from '../services/tenancy-api.service';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';

const FALLBACK_UNITS = ['Matelândia', 'Medianeira', 'Céu Azul', 'Itaipulândia', 'Missal'];

interface LocationView {
  location: CompanyLocation;
  areaTags: { id: RiskAreaId; name: string; nr: string }[];
}

@Component({
  selector: 'app-pet-locations',
  standalone: true,
  imports: [IconComponent, IndustrialArtComponent],
  templateUrl: './pet-locations.component.html',
  styleUrl: './pet-locations.component.scss',
})
export class PetLocationsComponent {
  readonly riskAreas = RISK_AREAS;

  readonly modalOpen = signal(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly editingId = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly cadName = signal('');
  readonly cadUnit = signal('Matelândia');
  readonly cadRiskAreas = signal<RiskAreaId[]>([]);

  readonly deleteTarget = signal<CompanyLocation | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  // Mesma lógica de fallback do seletor "Unidade" em Funcionários e no
  // assistente "Nova PET": mock por padrão, troca pelas filiais reais do
  // grupo assim que carregam.
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

  readonly locations = computed<LocationView[]>(() =>
    [...this.state.companyLocations()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((location) => ({
        location,
        areaTags: location.riskAreas.map((id) => ({ id, name: riskAreaName(id), nr: riskAreaNr(id) })),
      })),
  );

  openModal(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.saveError.set(null);
    this.cadName.set('');
    this.cadUnit.set(this.unitOptions()[0] ?? 'Matelândia');
    this.cadRiskAreas.set([]);
    this.modalOpen.set(true);
  }

  openEditModal(location: CompanyLocation): void {
    this.dialogMode.set('edit');
    this.editingId.set(location.id);
    this.saveError.set(null);
    this.cadName.set(location.name);
    this.cadUnit.set(location.unit);
    this.cadRiskAreas.set([...location.riskAreas]);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  toggleCadRiskArea(id: RiskAreaId): void {
    this.cadRiskAreas.update((areas) =>
      areas.includes(id) ? areas.filter((a) => a !== id) : [...areas, id],
    );
  }

  readonly cadMissing = computed(() => {
    const missing: string[] = [];
    if (!this.cadName().trim()) missing.push('nome do local');
    if (this.cadRiskAreas().length === 0) missing.push('ao menos uma área de risco');
    return missing;
  });

  readonly cadDisabled = computed(() => this.cadMissing().length > 0 || this.saving());

  readonly dialogTitle = computed(() =>
    this.dialogMode() === 'edit' ? 'Editar local' : 'Cadastrar local',
  );
  readonly dialogActionLabel = computed(() =>
    this.saving() ? 'Salvando…' : this.dialogMode() === 'edit' ? 'Salvar alterações' : 'Cadastrar local',
  );

  async save(): Promise<void> {
    if (this.cadDisabled()) return;

    if (this.dialogMode() === 'edit') {
      const id = this.editingId();
      if (!id) return;
      this.saving.set(true);
      this.saveError.set(null);
      try {
        await this.state.updateCompanyLocation(id, {
          name: this.cadName().trim(),
          unit: this.cadUnit(),
          riskAreas: this.cadRiskAreas(),
        });
        this.modalOpen.set(false);
      } catch (err) {
        this.saveError.set(locationErrorMessage(err, 'salvar'));
      } finally {
        this.saving.set(false);
      }
      return;
    }

    // registerCompanyLocation nunca rejeita — sem servidor, ela cai para um
    // registro só na memória (ver PetStateService), então não há erro para
    // tratar aqui, diferente de editar/excluir.
    this.saving.set(true);
    await this.state.registerCompanyLocation({
      name: this.cadName().trim(),
      unit: this.cadUnit(),
      riskAreas: this.cadRiskAreas(),
    });
    this.saving.set(false);
    this.modalOpen.set(false);
  }

  openDeleteDialog(location: CompanyLocation): void {
    this.deleteTarget.set(location);
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
      await this.state.deleteCompanyLocation(target.id);
      this.deleteTarget.set(null);
    } catch (err) {
      this.deleteError.set(locationErrorMessage(err, 'excluir'));
    } finally {
      this.deleting.set(false);
    }
  }
}

function locationErrorMessage(err: unknown, acao: 'cadastrar' | 'salvar' | 'excluir'): string {
  const status = (err as { status?: number })?.status;

  if (status === 0 || status === undefined || status >= 502) {
    return `Servidor indisponível: o local não foi ${acao === 'excluir' ? 'excluído' : 'salvo'}. Tente de novo quando a conexão voltar.`;
  }
  if (status === 401) {
    return 'Sua sessão expirou. Entre de novo com e-mail e senha para continuar.';
  }
  if (status === 403) {
    return `Seu perfil não tem alçada para ${acao} locais. Procure o SESMT.`;
  }
  if (status === 404) {
    return 'Este local não existe mais no cadastro — atualize a lista.';
  }
  if (status === 400) {
    return 'Confira os campos: algum valor não foi aceito pelo servidor.';
  }
  return `Não foi possível ${acao} agora. Tente novamente.`;
}
