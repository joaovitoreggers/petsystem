import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyGroupId: string | null;
  branchId: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  companyGroupId?: string;
  branchId?: string;
}

// `branchId` distingue "não mexer" (omitido) de "limpar a filial, ver todas
// as filiais do grupo" (`null` explícito) — só faz sentido numa edição.
export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'branchId'>> & {
  branchId?: string | null;
};

/**
 * CRUD de contas de login (`User`) contra `/api/users` — todas as rotas
 * exigem o JWT da sessão (anexado pelo authInterceptor); criar/editar/
 * excluir exigem além disso o papel admin/gestor (RolesGuard no back-end).
 */
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<SystemUser[]> {
    return this.http.get<SystemUser[]>(this.baseUrl);
  }

  create(payload: CreateUserPayload): Observable<SystemUser> {
    return this.http.post<SystemUser>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<SystemUser> {
    return this.http.patch<SystemUser>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
