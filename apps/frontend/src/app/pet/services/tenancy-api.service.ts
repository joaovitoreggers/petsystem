import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CompanyGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  companyGroupId: string;
  name: string;
  createdAt: string;
}

/**
 * Grupos de empresas (tenants) e suas filiais — `/api/company-groups`.
 * Listar grupos e criar grupo são só para platform-admin; listar filiais de
 * um grupo também libera para o gestor daquele grupo (ele precisa escolher
 * uma filial ao cadastrar um usuário); criar filial exige admin/platform-admin.
 */
@Injectable({ providedIn: 'root' })
export class TenancyApiService {
  private readonly baseUrl = `${environment.apiUrl}/company-groups`;

  constructor(private readonly http: HttpClient) {}

  findGroups(): Observable<CompanyGroup[]> {
    return this.http.get<CompanyGroup[]>(this.baseUrl);
  }

  createGroup(name: string): Observable<CompanyGroup> {
    return this.http.post<CompanyGroup>(this.baseUrl, { name });
  }

  findBranches(groupId: string): Observable<Branch[]> {
    return this.http.get<Branch[]>(`${this.baseUrl}/${groupId}/branches`);
  }

  createBranch(groupId: string, name: string): Observable<Branch> {
    return this.http.post<Branch>(`${this.baseUrl}/${groupId}/branches`, { name });
  }
}
