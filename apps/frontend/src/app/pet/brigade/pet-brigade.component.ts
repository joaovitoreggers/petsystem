import { Component, computed, signal } from '@angular/core';
import { PetStateService } from '../pet-state.service';
import { EmergencyContact } from '../pet-mock-data';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';

@Component({
  selector: 'app-pet-brigade',
  standalone: true,
  imports: [IconComponent, IndustrialArtComponent],
  templateUrl: './pet-brigade.component.html',
  styleUrl: './pet-brigade.component.scss',
})
export class PetBrigadeComponent {
  readonly modalOpen = signal(false);
  readonly dialogMode = signal<'create' | 'edit'>('create');
  readonly editingId = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly cadName = signal('');
  readonly cadPhone = signal('');

  readonly deleteTarget = signal<EmergencyContact | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  constructor(readonly state: PetStateService) {}

  readonly contacts = computed(() =>
    [...this.state.emergencyContacts()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  openModal(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.saveError.set(null);
    this.cadName.set('');
    this.cadPhone.set('');
    this.modalOpen.set(true);
  }

  openEditModal(contact: EmergencyContact): void {
    this.dialogMode.set('edit');
    this.editingId.set(contact.id);
    this.saveError.set(null);
    this.cadName.set(contact.name);
    this.cadPhone.set(contact.phone);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  // E.164: + seguido de 8 a 15 dígitos — mesma validação do back-end (ver
  // CreateEmergencyContactDto), checada aqui só pra dar feedback antes de
  // enviar, não como fonte de verdade.
  private readonly E164 = /^\+[1-9]\d{7,14}$/;

  readonly cadMissing = computed(() => {
    const missing: string[] = [];
    if (!this.cadName().trim()) missing.push('nome');
    const phone = this.cadPhone().trim();
    if (!phone) missing.push('telefone');
    else if (!this.E164.test(phone)) missing.push('telefone no formato internacional (ex. +5545999999999)');
    return missing;
  });

  readonly cadDisabled = computed(() => this.cadMissing().length > 0 || this.saving());

  readonly dialogTitle = computed(() =>
    this.dialogMode() === 'edit' ? 'Editar contato' : 'Cadastrar contato',
  );
  readonly dialogActionLabel = computed(() =>
    this.saving() ? 'Salvando…' : this.dialogMode() === 'edit' ? 'Salvar alterações' : 'Cadastrar contato',
  );

  async save(): Promise<void> {
    if (this.cadDisabled()) return;

    if (this.dialogMode() === 'edit') {
      const id = this.editingId();
      if (!id) return;
      this.saving.set(true);
      this.saveError.set(null);
      try {
        await this.state.updateEmergencyContact(id, {
          name: this.cadName().trim(),
          phone: this.cadPhone().trim(),
        });
        this.modalOpen.set(false);
      } catch (err) {
        this.saveError.set(brigadeErrorMessage(err, 'salvar'));
      } finally {
        this.saving.set(false);
      }
      return;
    }

    // registerEmergencyContact nunca rejeita — sem servidor, ela cai para
    // um registro só na memória (ver PetStateService), então não há erro
    // para tratar aqui, diferente de editar/excluir.
    this.saving.set(true);
    await this.state.registerEmergencyContact({
      name: this.cadName().trim(),
      phone: this.cadPhone().trim(),
    });
    this.saving.set(false);
    this.modalOpen.set(false);
  }

  openDeleteDialog(contact: EmergencyContact): void {
    this.deleteTarget.set(contact);
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
      await this.state.deleteEmergencyContact(target.id);
      this.deleteTarget.set(null);
    } catch (err) {
      this.deleteError.set(brigadeErrorMessage(err, 'excluir'));
    } finally {
      this.deleting.set(false);
    }
  }
}

function brigadeErrorMessage(err: unknown, acao: 'salvar' | 'excluir'): string {
  const status = (err as { status?: number })?.status;

  if (status === 0 || status === undefined || status >= 502) {
    return `Servidor indisponível: o contato não foi ${acao === 'excluir' ? 'excluído' : 'salvo'}. Tente de novo quando a conexão voltar.`;
  }
  if (status === 401) {
    return 'Sua sessão expirou. Entre de novo com e-mail e senha para continuar.';
  }
  if (status === 403) {
    return `Seu perfil não tem alçada para ${acao} contatos da brigada. Procure o SESMT.`;
  }
  if (status === 404) {
    return 'Este contato não existe mais no cadastro — atualize a lista.';
  }
  if (status === 400) {
    return 'Confira os campos: algum valor não foi aceito pelo servidor.';
  }
  return `Não foi possível ${acao} agora. Tente novamente.`;
}
