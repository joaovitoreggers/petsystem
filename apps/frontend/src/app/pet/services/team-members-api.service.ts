import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TeamMember } from '../pet-mock-data';

export type CreateTeamMemberPayload = TeamMember;

@Injectable({ providedIn: 'root' })
export class TeamMembersApiService {
  private readonly baseUrl = `${environment.apiUrl}/team-members`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(this.baseUrl);
  }

  create(payload: CreateTeamMemberPayload): Observable<TeamMember> {
    return this.http.post<TeamMember>(this.baseUrl, payload);
  }
}
