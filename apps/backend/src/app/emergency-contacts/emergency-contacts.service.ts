import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
import { EmergencyContact } from './entities/emergency-contact.entity';
import {
  CreateEmergencyContactData,
  EMERGENCY_CONTACT_REPOSITORY,
  IEmergencyContactRepository,
  UpdateEmergencyContactData,
} from './repositories/emergency-contact-repository.interface';

export type CreateEmergencyContactInput = Omit<CreateEmergencyContactData, 'companyGroupId' | 'branchId'> & {
  companyGroupId?: string;
  branchId?: string;
};
export type UpdateEmergencyContactInput = UpdateEmergencyContactData;

const NOT_FOUND_MESSAGE = 'Contato não encontrado';

/**
 * Público boundary de EmergencyContactsModule. EvacuationModule depende só
 * deste service — nunca do repositório diretamente.
 */
@Injectable()
export class EmergencyContactsService {
  constructor(
    @Inject(EMERGENCY_CONTACT_REPOSITORY)
    private readonly emergencyContactRepository: IEmergencyContactRepository,
  ) {}

  async findAll(scope?: TenantScope): Promise<EmergencyContact[]> {
    const contacts = await this.emergencyContactRepository.findAll();
    return filterOwnedByScope(contacts, scope);
  }

  async create(data: CreateEmergencyContactInput, scope?: TenantScope): Promise<EmergencyContact> {
    const companyGroupId = data.companyGroupId ?? scope?.companyGroupId ?? null;
    if (!companyGroupId) {
      throw new BadRequestException(
        'Não foi possível determinar o grupo de empresas deste contato',
      );
    }
    const branchId = data.branchId ?? scope?.branchId ?? null;
    return this.emergencyContactRepository.create({
      name: data.name,
      phone: data.phone,
      companyGroupId,
      branchId,
    });
  }

  async update(id: string, data: UpdateEmergencyContactInput, scope?: TenantScope): Promise<EmergencyContact> {
    const current = await this.emergencyContactRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    const updated = await this.emergencyContactRepository.update(id, data);
    if (!updated) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return updated;
  }

  async delete(id: string, scope?: TenantScope): Promise<void> {
    const current = await this.emergencyContactRepository.findById(id);
    if (!current) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    assertOwnedByScope(current, scope, NOT_FOUND_MESSAGE);

    await this.emergencyContactRepository.delete(id);
  }
}
