import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkPermit, WorkPermitGasReading } from './entities/work-permit.entity';
import {
  CreateWorkPermitData,
  IWorkPermitRepository,
  WORK_PERMIT_REPOSITORY,
} from './repositories/work-permit-repository.interface';

export type CreateWorkPermitInput = CreateWorkPermitData;

export interface CloseWorkPermitInput {
  end: string;
  durationMinutes: number;
}

/**
 * Público boundary de WorkPermitsModule — controllers e outros módulos só
 * dependem deste service.
 */
@Injectable()
export class WorkPermitsService {
  constructor(
    @Inject(WORK_PERMIT_REPOSITORY)
    private readonly workPermitRepository: IWorkPermitRepository,
  ) {}

  findAll(): Promise<WorkPermit[]> {
    return this.workPermitRepository.findAll();
  }

  findById(id: string): Promise<WorkPermit | null> {
    return this.workPermitRepository.findById(id);
  }

  create(data: CreateWorkPermitInput): Promise<WorkPermit> {
    return this.workPermitRepository.create(data);
  }

  async close(id: string, data: CloseWorkPermitInput): Promise<WorkPermit> {
    const closed = await this.workPermitRepository.close(id, data);
    if (!closed) {
      throw new NotFoundException('PET não encontrada');
    }
    return closed;
  }
}

export type { WorkPermitGasReading };
