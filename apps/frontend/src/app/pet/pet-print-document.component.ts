import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  ChecklistAnswer,
  GAS_LIMITS,
  GasKey,
  PET_TEAM_ROLE_LABEL,
  Pet,
  buildChecklistGroups,
  dateToBr,
  isGasWithinLimit,
  petStatusView,
  riskAreaNames,
  riskAreaNrs,
} from './pet-mock-data';
import {
  SignatureLifecycleEvent,
  SignatureMethod,
  SignaturePetRole,
  WorkPermitSignature,
} from './services/work-permit-signatures-api.service';

interface FieldRow {
  label: string;
  value: string;
}

interface GasRow {
  label: string;
  value: string;
  limit: string;
  ok: boolean;
}

interface ChecklistRowGroup {
  title: string;
  items: { key: string; label: string; answer: ChecklistAnswer }[];
}

interface EventRow {
  time: string;
  type: string;
  text: string;
}

interface TeamRow {
  name: string;
  registration: string;
  role: string;
  roleLabel: string;
}

interface SignatureRow {
  signerName: string;
  role: string;
  event: string;
  method: string;
  signedAt: string;
}

const SIGNATURE_ROLE_LABEL: Record<SignaturePetRole, string> = {
  emitente: 'Emitente',
  executante: 'Executante',
  encerrante: 'Encerramento',
};

const SIGNATURE_METHOD_LABEL: Record<SignatureMethod, string> = {
  biometria: 'Biometria',
  cracha_pin: 'Crachá + PIN',
  sms_otp: 'Código SMS/WhatsApp',
};

const SIGNATURE_LIFECYCLE_LABEL: Record<SignatureLifecycleEvent, string> = {
  abertura: 'Abertura',
  encerramento: 'Encerramento',
};

/**
 * Documento de impressão de uma PET — tabulado, formatado, sem o card/ícone
 * decorativo das telas de detalhe (técnico e painel de gestão usam este
 * mesmo componente, cada um alimentando com sua própria `pet`/`signatures`
 * já carregadas). Fica sempre no DOM, escondido por `:host` (ver
 * pet-print-document.component.scss) — só visível durante a impressão, via
 * a classe `pet-detail-printing` no body (ver styles.scss e o `printPet()`
 * de PetTechnicianComponent/PetManagerComponent).
 */
@Component({
  selector: 'app-pet-print-document',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './pet-print-document.component.html',
  styleUrls: ['./pet-print-document.component.scss', './manager/pet-report.scss'],
})
export class PetPrintDocumentComponent {
  @Input({ required: true }) pet!: Pet;
  @Input({ required: true }) signatures!: WorkPermitSignature[];

  get statusView(): { label: string; fg: string; bg: string } {
    return petStatusView(this.pet);
  }

  get areaLabel(): string {
    return riskAreaNames(this.pet.areas);
  }

  get nr(): string {
    return riskAreaNrs(this.pet.areas);
  }

  // Campos discretos, um por linha — inclui o que hoje só aparece na
  // interpolação do cabeçalho ou preso em texto corrido na timeline
  // (motivo/responsável do encerramento), porque um documento tabulado não
  // deve guardar fato nenhum só em prosa.
  get fieldRows(): FieldRow[] {
    const p = this.pet;
    const rows: FieldRow[] = [
      { label: 'Local', value: p.location },
      { label: 'Unidade', value: p.unit },
      { label: 'Data de abertura', value: dateToBr(p.date) },
      { label: 'Horário de abertura', value: p.start },
      { label: 'Horário de encerramento', value: p.end || 'em andamento' },
      { label: 'Técnico responsável', value: p.technician },
      { label: 'Tamanho da equipe', value: String(p.teamSize) },
    ];
    if (p.coordinates) rows.push({ label: 'Coordenadas GPS de abertura', value: p.coordinates });
    if (p.serviceType) rows.push({ label: 'Tipo de intervenção', value: p.serviceType });
    if (p.executingCompany) rows.push({ label: 'Empresa executante', value: p.executingCompany });
    if (p.plannedStart) rows.push({ label: 'Início previsto', value: p.plannedStart });
    if (p.plannedEnd) rows.push({ label: 'Término previsto', value: p.plannedEnd });
    if (p.companyPhone) rows.push({ label: 'Telefone', value: p.companyPhone });
    if (p.description) rows.push({ label: 'Descrição do serviço', value: p.description });
    if (p.closeReason) rows.push({ label: 'Motivo do encerramento', value: p.closeReason });
    if (p.closedBy) rows.push({ label: 'Responsável pelo encerramento', value: p.closedBy });
    return rows;
  }

  get hasGas(): boolean {
    return !!this.pet.gas;
  }

  get gasRows(): GasRow[] {
    const gas = this.pet.gas;
    if (!gas) return [];
    const keys: GasKey[] = ['o2', 'co', 'h2s', 'lel'];
    return keys.map((key) => {
      const limit = GAS_LIMITS[key];
      const value = gas[key];
      return {
        label: limit.label,
        value: `${value.toFixed(limit.decimals)} ${limit.unit}`,
        limit: limit.limitText,
        ok: isGasWithinLimit(key, value),
      };
    });
  }

  get readingRows(): { time: string; text: string }[] {
    return this.pet.readings ?? [];
  }

  get teamRows(): TeamRow[] {
    return (this.pet.team ?? []).map((m) => ({
      name: m.name,
      registration: m.registration,
      role: m.role,
      roleLabel: PET_TEAM_ROLE_LABEL[m.petRole],
    }));
  }

  // Mesma reconstituição de detailChecklistGroups (PetTechnicianComponent):
  // reconstrói os grupos a partir das áreas da PET e mantém só os itens que
  // de fato têm resposta salva.
  get checklistGroups(): ChecklistRowGroup[] {
    const checklist = this.pet.checklist;
    if (!checklist) return [];
    return buildChecklistGroups(this.pet.areas)
      .map((group) => ({
        title: group.title,
        items: group.items
          .filter((item) => checklist[item.key] !== undefined)
          .map((item) => ({ ...item, answer: checklist[item.key] })),
      }))
      .filter((group) => group.items.length > 0);
  }

  // Só os eventos de fato excepcionais (liberação com ressalva, atmosfera
  // fora do limite) — o registro de medições de rotina já tem sua própria
  // tabela na seção de medição atmosférica, não duplicado aqui. Mesma ordem
  // fixa por grupo que a timeline da tela já usa (não é uma junção
  // cronológica de verdade).
  get eventRows(): EventRow[] {
    const rows: EventRow[] = [];
    for (const alert of this.pet.criticalAlerts ?? []) {
      rows.push({ time: alert.timestamp, type: 'Liberação com ressalva', text: alert.message });
    }
    for (const alert of this.pet.atmosphereAlerts ?? []) {
      rows.push({ time: alert.timestamp, type: 'Atmosfera fora do limite', text: alert.message });
    }
    return rows;
  }

  get signatureRows(): SignatureRow[] {
    return this.signatures.map((sig) => ({
      signerName: sig.signerName,
      role: SIGNATURE_ROLE_LABEL[sig.petRole],
      event: SIGNATURE_LIFECYCLE_LABEL[sig.lifecycleEvent],
      method: SIGNATURE_METHOD_LABEL[sig.method],
      signedAt: sig.signedAt,
    }));
  }

  // Numeração de seção dinâmica — seções condicionais (medição, checklist,
  // eventos) somem quando não há dado; numerar 1/2/3 fixo no template
  // deixaria buracos (ex. "3. Checklist" seguido de "6. Assinaturas") que
  // parecem documento incompleto pra quem audita.
  private get visibleSectionIds(): string[] {
    const ids = ['fields'];
    if (this.hasGas) ids.push('gas');
    ids.push('team');
    if (this.checklistGroups.length > 0) ids.push('checklist');
    if (this.eventRows.length > 0) ids.push('events');
    ids.push('signatures');
    return ids;
  }

  sectionNumber(id: string): number {
    return this.visibleSectionIds.indexOf(id) + 1;
  }
}
