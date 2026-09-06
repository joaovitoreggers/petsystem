import {
  WorkPermit,
  WorkPermitCriticalAlert,
  WorkPermitGasReading,
  WorkPermitStatus,
  WorkPermitTeamMember,
} from '../entities/work-permit.entity';

export interface AddReadingData {
  gas: WorkPermitGasReading;
}

export interface CreateWorkPermitData {
  id?: string;
  areas: string[];
  location: string;
  unit: string;
  teamSize: number;
  date: string;
  start: string;
  end?: string;
  timeLabel?: string;
  technician: string;
  status?: WorkPermitStatus;
  coordinates?: string;
  gas?: WorkPermitGasReading;
  alarm?: boolean;
  durationMinutes?: number;
  criticalAlerts?: WorkPermitCriticalAlert[];
  team?: WorkPermitTeamMember[];
  companyPhone?: string;
}

export interface CloseWorkPermitData {
  end: string;
  durationMinutes: number;
  reason?: string;
  closedBy?: string;
}

/**
 * Repository pattern: isolates data access for WorkPermit from the ORM
 * choice. Only WorkPermitsModule may depend on this token; other modules
 * go through WorkPermitsService.
 */
export interface IWorkPermitRepository {
  findAll(): Promise<WorkPermit[]>;
  findById(id: string): Promise<WorkPermit | null>;
  create(data: CreateWorkPermitData): Promise<WorkPermit>;
  close(id: string, data: CloseWorkPermitData): Promise<WorkPermit | null>;
  addReading(id: string, data: AddReadingData): Promise<WorkPermit | null>;
}

export const WORK_PERMIT_REPOSITORY = Symbol('WORK_PERMIT_REPOSITORY');
