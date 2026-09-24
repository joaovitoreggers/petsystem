import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkPermitSignature } from '../entities/work-permit-signature.entity';
import {
  CreateWorkPermitSignatureData,
  IWorkPermitSignatureRepository,
} from './work-permit-signature-repository.interface';

@Injectable()
export class WorkPermitSignatureRepository implements IWorkPermitSignatureRepository {
  constructor(
    @InjectRepository(WorkPermitSignature)
    private readonly repository: Repository<WorkPermitSignature>,
  ) {}

  create(data: CreateWorkPermitSignatureData): Promise<WorkPermitSignature> {
    const signature = this.repository.create({
      id: randomUUID(),
      workPermitId: data.workPermitId ?? null,
      draftId: data.draftId ?? null,
      petRole: data.petRole,
      lifecycleEvent: data.lifecycleEvent,
      signerType: data.signerType,
      signerUserId: data.signerUserId,
      signerTeamMemberRegistration: data.signerTeamMemberRegistration,
      signerName: data.signerName,
      method: data.method,
      contentHash: data.contentHash,
      contentSnapshot: data.contentSnapshot,
      webauthnCredentialId: data.webauthnCredentialId ?? null,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
      geolocation: data.geolocation ?? null,
      companyGroupId: data.companyGroupId,
      branchId: data.branchId,
    });
    return this.repository.save(signature);
  }

  findByDraftId(draftId: string): Promise<WorkPermitSignature[]> {
    return this.repository.find({ where: { draftId }, order: { signedAt: 'ASC' } });
  }

  findByWorkPermitId(workPermitId: string): Promise<WorkPermitSignature[]> {
    return this.repository.find({ where: { workPermitId }, order: { signedAt: 'ASC' } });
  }

  async linkDraftToWorkPermit(draftId: string, workPermitId: string): Promise<void> {
    await this.repository.update({ draftId }, { workPermitId });
  }
}
