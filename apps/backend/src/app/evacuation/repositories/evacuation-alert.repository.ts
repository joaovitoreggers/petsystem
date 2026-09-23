import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvacuationAlert } from '../entities/evacuation-alert.entity';
import {
  CreateEvacuationAlertData,
  IEvacuationAlertRepository,
} from './evacuation-alert-repository.interface';

@Injectable()
export class EvacuationAlertRepository implements IEvacuationAlertRepository {
  constructor(
    @InjectRepository(EvacuationAlert)
    private readonly repository: Repository<EvacuationAlert>,
  ) {}

  findById(id: string): Promise<EvacuationAlert | null> {
    return this.repository.findOneBy({ id });
  }

  create(data: CreateEvacuationAlertData): Promise<EvacuationAlert> {
    const alert = this.repository.create({
      workPermitId: data.workPermitId,
      companyGroupId: data.companyGroupId,
      branchId: data.branchId,
      resolvedAt: null,
    });
    return this.repository.save(alert);
  }

  async markResolved(id: string): Promise<void> {
    await this.repository.update({ id }, { resolvedAt: new Date() });
  }
}
