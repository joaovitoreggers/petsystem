import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '../auth/tenant-scope';
import { EmergencyContactsService } from '../emergency-contacts/emergency-contacts.service';
import { WorkPermit } from '../work-permits/entities/work-permit.entity';
import { WorkPermitsService } from '../work-permits/work-permits.service';
import { NotificationsService } from './notifications.service';
import {
  EVACUATION_ALERT_REPOSITORY,
  IEvacuationAlertRepository,
} from './repositories/evacuation-alert-repository.interface';
import {
  PublicEvacuationStatus,
  TriggerEvacuationResult,
} from './evacuation.types';

const NOT_FOUND_MESSAGE = 'Alerta de evacuação não encontrado';

/**
 * Público boundary de EvacuationModule. Orquestra o que acontece quando uma
 * evacuação é acionada: registra o alerta, busca a brigada cadastrada
 * (EmergencyContactsModule) e dispara SMS/WhatsApp (NotificationsService)
 * com um link para a página pública de status — ver getPublicStatus.
 */
@Injectable()
export class EvacuationService {
  constructor(
    @Inject(EVACUATION_ALERT_REPOSITORY)
    private readonly evacuationAlertRepository: IEvacuationAlertRepository,
    private readonly workPermitsService: WorkPermitsService,
    private readonly emergencyContactsService: EmergencyContactsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async trigger(workPermitId: string | null, scope: TenantScope): Promise<TriggerEvacuationResult> {
    const permit = workPermitId
      ? await this.workPermitsService.findById(workPermitId, scope)
      : null;

    const alert = await this.evacuationAlertRepository.create({
      workPermitId: permit?.id ?? null,
      companyGroupId: scope.companyGroupId,
      branchId: scope.branchId,
    });

    const contacts = await this.emergencyContactsService.findAll(scope);
    const statusUrl = this.notificationsService.buildStatusLink(alert.id);
    const message = this.composeMessage(permit, statusUrl);
    const deliveries = await this.notificationsService.notifyContacts(contacts, message);

    return {
      alertId: alert.id,
      statusUrl,
      contactsNotified: contacts.length,
      deliveries,
    };
  }

  async resolve(id: string, scope: TenantScope): Promise<void> {
    const alert = await this.evacuationAlertRepository.findById(id);
    if (!alert) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    if (
      scope.role !== 'platform-admin' &&
      alert.companyGroupId !== scope.companyGroupId
    ) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    await this.evacuationAlertRepository.markResolved(id);
  }

  // Deliberadamente sem checagem de tenant — o token (o próprio id, um
  // uuid não-adivinhável) é a autorização: é assim que quem recebe o
  // SMS/WhatsApp, sem login nenhum, consegue ver a situação.
  async getPublicStatus(id: string): Promise<PublicEvacuationStatus | null> {
    const alert = await this.evacuationAlertRepository.findById(id);
    if (!alert) {
      return null;
    }

    const scope: TenantScope = {
      role: 'platform-admin',
      companyGroupId: alert.companyGroupId,
      branchId: alert.branchId,
    };

    if (alert.workPermitId) {
      const permit = await this.workPermitsService.findById(alert.workPermitId, scope);
      return {
        alertId: alert.id,
        triggeredAt: alert.triggeredAt.toISOString(),
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
        workPermit: permit ? this.toPublicWorkPermit(permit) : null,
        summary: null,
      };
    }

    const openPermits = (await this.workPermitsService.findAll({
      role: 'platform-admin',
      companyGroupId: alert.companyGroupId,
      branchId: alert.branchId,
    })).filter((p) => p.status !== 'fechada');

    return {
      alertId: alert.id,
      triggeredAt: alert.triggeredAt.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      workPermit: null,
      summary: {
        openPets: openPermits.length,
        peopleInField: openPermits.reduce((sum, p) => sum + p.teamSize, 0),
        units: new Set(openPermits.map((p) => p.unit)).size,
      },
    };
  }

  private toPublicWorkPermit(permit: WorkPermit) {
    return {
      id: permit.id,
      location: permit.location,
      unit: permit.unit,
      areas: permit.areas,
      status: permit.status,
      teamSize: permit.teamSize,
      technician: permit.technician,
    };
  }

  // Sem acento de propósito: SMS em GSM-7 cabe 160 caracteres por segmento,
  // mas qualquer caractere fora da tabela (incluindo acento) troca a
  // codificação inteira pra UCS-2, que cabe só 70 — o mesmo texto viraria
  // 3 segmentos em vez de 1. WhatsApp não tem essa restrição, mas usar a
  // mesma mensagem nos dois canais é mais simples que manter duas versões.
  private composeMessage(permit: WorkPermit | null, statusUrl: string): string {
    const where = permit ? `${permit.location} - ${permit.unit}` : 'frentes de trabalho ativas';
    return `EVACUACAO ACIONADA - ${where}. Acompanhe a situacao em tempo real: ${statusUrl}`;
  }
}
