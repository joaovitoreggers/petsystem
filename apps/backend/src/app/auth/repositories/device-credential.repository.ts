import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceCredential } from '../entities/device-credential.entity';
import {
  CreateDeviceCredentialData,
  IDeviceCredentialRepository,
} from './device-credential-repository.interface';

@Injectable()
export class DeviceCredentialRepository implements IDeviceCredentialRepository {
  constructor(
    @InjectRepository(DeviceCredential)
    private readonly repository: Repository<DeviceCredential>,
  ) {}

  findById(id: string): Promise<DeviceCredential | null> {
    return this.repository.findOneBy({ id });
  }

  create(data: CreateDeviceCredentialData): Promise<DeviceCredential> {
    const credential = this.repository.create({
      id: data.id,
      userId: data.userId,
      secretHash: data.secretHash,
      lastUsedAt: null,
    });
    return this.repository.save(credential);
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.repository.update({ id }, { lastUsedAt: new Date() });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
