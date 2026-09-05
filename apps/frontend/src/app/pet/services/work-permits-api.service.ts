import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CriticalAlert, GasReading, Pet, RiskAreaId } from '../pet-mock-data';

export interface CreateWorkPermitPayload {
  areas: RiskAreaId[];
  location: string;
  unit: string;
  teamSize: number;
  date: string;
  start: string;
  technician: string;
  coordinates?: string;
  gas?: GasReading;
  alarm?: boolean;
  criticalAlerts?: CriticalAlert[];
  companyPhone?: string;
}

export interface CloseWorkPermitPayload {
  end: string;
  durationMinutes: number;
  reason?: string;
  closedBy?: string;
}

@Injectable({ providedIn: 'root' })
export class WorkPermitsApiService {
  private readonly baseUrl = `${environment.apiUrl}/work-permits`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<Pet[]> {
    return this.http.get<Pet[]>(this.baseUrl);
  }

  create(payload: CreateWorkPermitPayload): Observable<Pet> {
    return this.http.post<Pet>(this.baseUrl, payload);
  }

  close(id: string, payload: CloseWorkPermitPayload): Observable<Pet> {
    return this.http.patch<Pet>(`${this.baseUrl}/${id}/close`, payload);
  }

  addReading(id: string, gas: GasReading): Observable<Pet> {
    return this.http.patch<Pet>(`${this.baseUrl}/${id}/reading`, { gas });
  }
}
