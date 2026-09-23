import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type DeliveryStatus = 'sent' | 'failed' | 'not_configured';

export interface ContactDelivery {
  contactId: string;
  sms: DeliveryStatus;
  whatsapp: DeliveryStatus;
}

export interface TriggerEvacuationResult {
  alertId: string;
  statusUrl: string;
  contactsNotified: number;
  deliveries: ContactDelivery[];
}

export interface PublicWorkPermitStatus {
  id: string;
  location: string;
  unit: string;
  areas: string[];
  status: string;
  teamSize: number;
  technician: string;
}

export interface PublicOpenPetsSummary {
  openPets: number;
  peopleInField: number;
  units: number;
}

export interface PublicEvacuationStatus {
  alertId: string;
  triggeredAt: string;
  resolvedAt: string | null;
  workPermit: PublicWorkPermitStatus | null;
  summary: PublicOpenPetsSummary | null;
}

@Injectable({ providedIn: 'root' })
export class EvacuationApiService {
  private readonly baseUrl = `${environment.apiUrl}/evacuation`;

  constructor(private readonly http: HttpClient) {}

  trigger(workPermitId: string | null): Observable<TriggerEvacuationResult> {
    return this.http.post<TriggerEvacuationResult>(`${this.baseUrl}/trigger`, {
      workPermitId: workPermitId ?? undefined,
    });
  }

  resolve(alertId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${alertId}/resolve`, {});
  }

  // Sem o interceptor de auth atrapalhar: a rota é pública (ver
  // EvacuationController.publicStatus), então funciona igual com ou sem
  // sessão — quem abre o link do SMS pode nunca ter feito login.
  publicStatus(alertId: string): Observable<PublicEvacuationStatus> {
    return this.http.get<PublicEvacuationStatus>(`${this.baseUrl}/public/${alertId}`);
  }
}
