import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyLocation } from '../pet-mock-data';

export type CreateCompanyLocationPayload = Omit<CompanyLocation, 'id'>;

export type UpdateCompanyLocationPayload = Partial<
  Pick<CompanyLocation, 'name' | 'riskAreas' | 'unit'>
>;

@Injectable({ providedIn: 'root' })
export class CompanyLocationsApiService {
  private readonly baseUrl = `${environment.apiUrl}/company-locations`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<CompanyLocation[]> {
    return this.http.get<CompanyLocation[]>(this.baseUrl);
  }

  create(payload: CreateCompanyLocationPayload): Observable<CompanyLocation> {
    return this.http.post<CompanyLocation>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateCompanyLocationPayload): Observable<CompanyLocation> {
    return this.http.patch<CompanyLocation>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
