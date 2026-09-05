import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel: number;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  accessLevel: number;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  accessLevel?: number;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.baseUrl);
  }

  findOne(id: string): Observable<UserSummary> {
    return this.http.get<UserSummary>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateUserPayload): Observable<UserSummary> {
    return this.http.post<UserSummary>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<UserSummary> {
    return this.http.patch<UserSummary>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
