import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EmployeeSummary {
  id: string;
  name: string;
  role: string;
  canAccessRiskAreas: boolean;
  canPerformCorrectiveService: boolean;
}

export interface CreateEmployeePayload {
  name: string;
  role: string;
  canAccessRiskAreas?: boolean;
  canPerformCorrectiveService?: boolean;
}

export interface UpdateEmployeePayload {
  name?: string;
  role?: string;
  canAccessRiskAreas?: boolean;
  canPerformCorrectiveService?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmployeesApiService {
  private readonly baseUrl = `${environment.apiUrl}/employees`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<EmployeeSummary[]> {
    return this.http.get<EmployeeSummary[]>(this.baseUrl);
  }

  findOne(id: string): Observable<EmployeeSummary> {
    return this.http.get<EmployeeSummary>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateEmployeePayload): Observable<EmployeeSummary> {
    return this.http.post<EmployeeSummary>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateEmployeePayload): Observable<EmployeeSummary> {
    return this.http.patch<EmployeeSummary>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
