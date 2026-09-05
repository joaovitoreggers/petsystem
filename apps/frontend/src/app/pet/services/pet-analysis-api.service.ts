import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PetAnalysisAreaStat {
  areaId: string;
  areaLabel: string;
  nr: string;
  total: number;
  occurrences: number;
  occurrenceRate: number;
}

export interface PetAnalysisDailyStat {
  date: string;
  count: number;
}

export interface PetAnalysisSummary {
  totalCount: number;
  openCount: number;
  closedCount: number;
  totalOccurrences: number;
  avgPerDay: number;
  byArea: PetAnalysisAreaStat[];
  byDate: PetAnalysisDailyStat[];
  unusualDays: PetAnalysisDailyStat[];
  unusualAreas: PetAnalysisAreaStat[];
}

export interface PetAnalysisResult {
  generatedAt: string;
  summary: PetAnalysisSummary;
  reportText: string;
}

@Injectable({ providedIn: 'root' })
export class PetAnalysisApiService {
  private readonly baseUrl = `${environment.apiUrl}/pet-analysis`;

  constructor(private readonly http: HttpClient) {}

  analyze(): Observable<PetAnalysisResult> {
    return this.http.post<PetAnalysisResult>(this.baseUrl, {});
  }
}
