import { DeviceCredential } from '../entities/device-credential.entity';

export interface CreateDeviceCredentialData {
  id: string;
  userId: string;
  secretHash: string;
}

/**
 * Repository pattern: isolates data access for DeviceCredential from the
 * ORM choice. Only AuthModule may depend on this token.
 */
export interface IDeviceCredentialRepository {
  findById(id: string): Promise<DeviceCredential | null>;
  create(data: CreateDeviceCredentialData): Promise<DeviceCredential>;
  touchLastUsed(id: string): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export const DEVICE_CREDENTIAL_REPOSITORY = Symbol('DEVICE_CREDENTIAL_REPOSITORY');
