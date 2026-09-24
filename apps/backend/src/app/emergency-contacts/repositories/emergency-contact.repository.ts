import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyContact } from '../entities/emergency-contact.entity';
import {
  CreateEmergencyContactData,
  IEmergencyContactRepository,
  UpdateEmergencyContactData,
} from './emergency-contact-repository.interface';

@Injectable()
export class EmergencyContactRepository implements IEmergencyContactRepository {
  constructor(
    @InjectRepository(EmergencyContact)
    private readonly repository: Repository<EmergencyContact>,
  ) {}

  findAll(): Promise<EmergencyContact[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<EmergencyContact | null> {
    return this.repository.findOneBy({ id });
  }

  create(data: CreateEmergencyContactData): Promise<EmergencyContact> {
    const contact = this.repository.create({
      name: data.name,
      phone: data.phone,
      companyGroupId: data.companyGroupId ?? null,
      branchId: data.branchId ?? null,
    });
    return this.repository.save(contact);
  }

  async update(id: string, data: UpdateEmergencyContactData): Promise<EmergencyContact | null> {
    const contact = await this.repository.findOneBy({ id });
    if (!contact) {
      return null;
    }
    if (data.name !== undefined) contact.name = data.name;
    if (data.phone !== undefined) contact.phone = data.phone;
    return this.repository.save(contact);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
