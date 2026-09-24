import { EmergencyContact } from '../entities/emergency-contact.entity';

export interface CreateEmergencyContactData {
  name: string;
  phone: string;
  companyGroupId: string | null;
  branchId: string | null;
}

export interface UpdateEmergencyContactData {
  name?: string;
  phone?: string;
}

/**
 * Repository pattern: isolates data access for EmergencyContact from the
 * ORM choice. Only EmergencyContactsModule may depend on this token; other
 * modules go through EmergencyContactsService.
 */
export interface IEmergencyContactRepository {
  findAll(): Promise<EmergencyContact[]>;
  findById(id: string): Promise<EmergencyContact | null>;
  create(data: CreateEmergencyContactData): Promise<EmergencyContact>;
  update(id: string, data: UpdateEmergencyContactData): Promise<EmergencyContact | null>;
  delete(id: string): Promise<void>;
}

export const EMERGENCY_CONTACT_REPOSITORY = Symbol('EMERGENCY_CONTACT_REPOSITORY');
