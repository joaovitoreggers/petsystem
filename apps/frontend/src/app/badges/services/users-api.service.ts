import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: string;
  accessLevel: number;
  qrCode: string;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.baseUrl);
  }
}
