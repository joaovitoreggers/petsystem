import { ContactDelivery } from './notifications.service';

export interface TriggerEvacuationResult {
  alertId: string;
  statusUrl: string;
  contactsNotified: number;
  deliveries: ContactDelivery[];
}

export interface PublicWorkPermitStatus {
  id: string;
  location: string;
  unit: string;
  areas: string[];
  status: string;
  teamSize: number;
  technician: string;
}

export interface PublicOpenPetsSummary {
  openPets: number;
  peopleInField: number;
  units: number;
}

export interface PublicEvacuationStatus {
  alertId: string;
  triggeredAt: string;
  resolvedAt: string | null;
  workPermit: PublicWorkPermitStatus | null;
  summary: PublicOpenPetsSummary | null;
}
