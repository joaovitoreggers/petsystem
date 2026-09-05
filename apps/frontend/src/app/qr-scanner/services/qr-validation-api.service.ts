import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ReadResult = 'AUTHORIZED' | 'DENIED' | 'INVALID_QR' | 'DUPLICATE';
export type AttemptStatus =
  | 'AWAITING_DETECTION'
  | 'AWAITING_READS'
  | 'COMPLETE'
  | 'EXPIRED';

export interface ReadDto {
  qrCode: string;
  userId: number | null;
  result: ReadResult;
}

export interface AttemptDto {
  id: string;
  status: AttemptStatus;
  expectedCount: number;
  reads: ReadDto[];
  finalResult: ReadResult | null;
}

/**
 * Cliente HTTP fino para o QrValidationModule do back-end. O authInterceptor
 * compartilhado anexa o JWT em todas essas requisições.
 */
@Injectable({ providedIn: 'root' })
export class QrValidationApiService {
  private readonly baseUrl = `${environment.apiUrl}/qr-validation/attempts`;

  constructor(private readonly http: HttpClient) {}

  startAttempt(): Observable<AttemptDto> {
    return this.http.post<AttemptDto>(this.baseUrl, {});
  }

  startDetection(attemptId: string, personCount: number): Observable<AttemptDto> {
    return this.http.post<AttemptDto>(`${this.baseUrl}/${attemptId}/detection`, {
      personCount,
    });
  }

  recordRead(attemptId: string, qrCode: string): Observable<AttemptDto> {
    return this.http.post<AttemptDto>(`${this.baseUrl}/${attemptId}/reads`, {
      qrCode,
    });
  }
}
