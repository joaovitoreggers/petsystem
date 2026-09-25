import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChecklistCustomItem } from '../pet-mock-data';

export type CreateChecklistItemPayload = Omit<ChecklistCustomItem, 'id'>;
export type UpdateChecklistItemPayload = Partial<Pick<ChecklistCustomItem, 'label'>>;

@Injectable({ providedIn: 'root' })
export class ChecklistItemsApiService {
  private readonly baseUrl = `${environment.apiUrl}/checklist-items`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<ChecklistCustomItem[]> {
    return this.http.get<ChecklistCustomItem[]>(this.baseUrl);
  }

  create(payload: CreateChecklistItemPayload): Observable<ChecklistCustomItem> {
    return this.http.post<ChecklistCustomItem>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateChecklistItemPayload): Observable<ChecklistCustomItem> {
    return this.http.patch<ChecklistCustomItem>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
