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
 * Listar grupos, criar/renomear/excluir grupo são só para platform-admin;
 * listar filiais de um grupo libera pra qualquer sessão autenticada do
 * próprio grupo (o assistente de PET e o cadastro de funcionário precisam
 * da lista pra montar o seletor de unidade); criar/renomear/excluir filial
 * exige admin/platform-admin. Excluir (grupo ou filial) devolve 409 se
 * ainda houver algo vinculado.
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

  renameGroup(groupId: string, name: string): Observable<CompanyGroup> {
    return this.http.patch<CompanyGroup>(`${this.baseUrl}/${groupId}`, { name });
  }

  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${groupId}`);
  }

  findBranches(groupId: string): Observable<Branch[]> {
    return this.http.get<Branch[]>(`${this.baseUrl}/${groupId}/branches`);
  }

  createBranch(groupId: string, name: string): Observable<Branch> {
    return this.http.post<Branch>(`${this.baseUrl}/${groupId}/branches`, { name });
  }

  renameBranch(groupId: string, branchId: string, name: string): Observable<Branch> {
    return this.http.patch<Branch>(`${this.baseUrl}/${groupId}/branches/${branchId}`, { name });
  }

  deleteBranch(groupId: string, branchId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${groupId}/branches/${branchId}`);
  }
}
