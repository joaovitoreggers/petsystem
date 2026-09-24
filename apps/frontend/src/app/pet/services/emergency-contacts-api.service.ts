import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EmergencyContact } from '../pet-mock-data';

export type CreateEmergencyContactPayload = Omit<EmergencyContact, 'id'>;
export type UpdateEmergencyContactPayload = Partial<Pick<EmergencyContact, 'name' | 'phone'>>;

@Injectable({ providedIn: 'root' })
export class EmergencyContactsApiService {
  private readonly baseUrl = `${environment.apiUrl}/emergency-contacts`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<EmergencyContact[]> {
    return this.http.get<EmergencyContact[]>(this.baseUrl);
  }

  create(payload: CreateEmergencyContactPayload): Observable<EmergencyContact> {
    return this.http.post<EmergencyContact>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateEmergencyContactPayload): Observable<EmergencyContact> {
    return this.http.patch<EmergencyContact>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
