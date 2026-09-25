import { Component, computed, signal } from '@angular/core';
import { PetStateService } from '../pet-state.service';
import { ChecklistCustomItem, RISK_AREAS, RiskAreaId } from '../pet-mock-data';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';

@Component({
  selector: 'app-pet-checklist-items',
  standalone: true,
  imports: [IconComponent, IndustrialArtComponent],
  templateUrl: './pet-checklist-items.component.html',
  styleUrl: './pet-checklist-items.component.scss',
})
export class PetChecklistItemsComponent {
  readonly areas = RISK_AREAS;

  readonly filterAreaId = signal<RiskAreaId>(RISK_AREAS[0].id);

  readonly modalOpen = signal(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly editingId = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly cadAreaId = signal<RiskAreaId>(RISK_AREAS[0].id);
  readonly cadLabel = signal('');

  readonly deleteTarget = signal<ChecklistCustomItem | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  constructor(readonly state: PetStateService) {}

  readonly filteredItems = computed(() =>
    [...this.state.customChecklistItems()]
      .filter((item) => item.riskAreaId === this.filterAreaId())
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  setFilterArea(areaId: RiskAreaId): void {
    this.filterAreaId.set(areaId);
  }

  openModal(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.saveError.set(null);
    this.cadAreaId.set(this.filterAreaId());
    this.cadLabel.set('');
    this.modalOpen.set(true);
  }

  openEditModal(item: ChecklistCustomItem): void {
    this.dialogMode.set('edit');
    this.editingId.set(item.id);
    this.saveError.set(null);
    this.cadAreaId.set(item.riskAreaId);
    this.cadLabel.set(item.label);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  readonly cadMissing = computed(() => {
    const missing: string[] = [];
    if (!this.cadLabel().trim()) missing.push('o texto do item');
    return missing;
  });

  readonly cadDisabled = computed(() => this.cadMissing().length > 0 || this.saving());

  readonly dialogTitle = computed(() =>
    this.dialogMode() === 'edit' ? 'Editar item do checklist' : 'Cadastrar item do checklist',
  );
  readonly dialogActionLabel = computed(() =>
    this.saving() ? 'Salvando…' : this.dialogMode() === 'edit' ? 'Salvar alterações' : 'Cadastrar item',
  );

  async save(): Promise<void> {
    if (this.cadDisabled()) return;

    if (this.dialogMode() === 'edit') {
      const id = this.editingId();
      if (!id) return;
      this.saving.set(true);
      this.saveError.set(null);
      try {
        await this.state.updateChecklistItem(id, { label: this.cadLabel().trim() });
        this.modalOpen.set(false);
      } catch (err) {
        this.saveError.set(checklistItemErrorMessage(err, 'salvar'));
      } finally {
        this.saving.set(false);
      }
      return;
    }

    // registerChecklistItem nunca rejeita — sem servidor, ela cai para um
    // registro só na memória (ver PetStateService), então não há erro
    // para tratar aqui, diferente de editar/excluir.
    this.saving.set(true);
    await this.state.registerChecklistItem({
      riskAreaId: this.cadAreaId(),
      label: this.cadLabel().trim(),
    });
    this.saving.set(false);
    this.modalOpen.set(false);
    this.filterAreaId.set(this.cadAreaId());
  }

  openDeleteDialog(item: ChecklistCustomItem): void {
    this.deleteTarget.set(item);
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
      await this.state.deleteChecklistItem(target.id);
      this.deleteTarget.set(null);
    } catch (err) {
      this.deleteError.set(checklistItemErrorMessage(err, 'excluir'));
    } finally {
      this.deleting.set(false);
    }
  }
}

function checklistItemErrorMessage(err: unknown, acao: 'salvar' | 'excluir'): string {
  const status = (err as { status?: number })?.status;

  if (status === 0 || status === undefined || status >= 502) {
    return `Servidor indisponível: o item não foi ${acao === 'excluir' ? 'excluído' : 'salvo'}. Tente de novo quando a conexão voltar.`;
  }
  if (status === 401) {
    return 'Sua sessão expirou. Entre de novo com e-mail e senha para continuar.';
  }
  if (status === 403) {
    return `Seu perfil não tem alçada para ${acao} itens de checklist. Procure o SESMT.`;
  }
  if (status === 404) {
    return 'Este item não existe mais no cadastro — atualize a lista.';
  }
  if (status === 400) {
    return 'Confira os campos: algum valor não foi aceito pelo servidor.';
  }
  return `Não foi possível ${acao} agora. Tente novamente.`;
}
