import { EvacuationAlert } from '../entities/evacuation-alert.entity';

export interface CreateEvacuationAlertData {
  workPermitId: string | null;
  companyGroupId: string | null;
  branchId: string | null;
}

export interface IEvacuationAlertRepository {
  findById(id: string): Promise<EvacuationAlert | null>;
  create(data: CreateEvacuationAlertData): Promise<EvacuationAlert>;
  markResolved(id: string): Promise<void>;
}

export const EVACUATION_ALERT_REPOSITORY = Symbol('EVACUATION_ALERT_REPOSITORY');
