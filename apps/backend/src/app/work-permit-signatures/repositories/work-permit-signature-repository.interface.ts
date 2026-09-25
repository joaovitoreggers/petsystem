import {
  SignatureGeolocation,
  SignatureLifecycleEvent,
  SignatureMethod,
  SignaturePetRole,
  SignerType,
  WorkPermitSignature,
} from '../entities/work-permit-signature.entity';

export interface CreateWorkPermitSignatureData {
  workPermitId?: string | null;
  draftId?: string | null;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  signerType: SignerType;
  signerUserId: string | null;
  signerTeamMemberRegistration: string | null;
  signerName: string;
  method: SignatureMethod;
  contentHash: string;
  contentSnapshot: Record<string, unknown>;
  webauthnCredentialId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  geolocation?: SignatureGeolocation | null;
  companyGroupId: string | null;
  branchId: string | null;
}

/**
 * Repository pattern: isolates data access for WorkPermitSignature from the
 * ORM choice. Only WorkPermitSignaturesModule may depend on this token;
 * other modules go through WorkPermitSignaturesService.
 */
export interface IWorkPermitSignatureRepository {
  create(data: CreateWorkPermitSignatureData): Promise<WorkPermitSignature>;
  findByDraftId(draftId: string): Promise<WorkPermitSignature[]>;
  findByWorkPermitId(workPermitId: string): Promise<WorkPermitSignature[]>;
  linkDraftToWorkPermit(draftId: string, workPermitId: string): Promise<void>;
}

export const WORK_PERMIT_SIGNATURE_REPOSITORY = Symbol('WORK_PERMIT_SIGNATURE_REPOSITORY');
