import { WebAuthnCredential } from '../entities/webauthn-credential.entity';

export interface CreateWebAuthnCredentialData {
  id: string;
  userId: string;
  publicKey: Buffer;
  counter: number;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
}

export interface IWebAuthnCredentialRepository {
  findById(id: string): Promise<WebAuthnCredential | null>;
  findByUserId(userId: string): Promise<WebAuthnCredential[]>;
  create(data: CreateWebAuthnCredentialData): Promise<WebAuthnCredential>;
  updateCounter(id: string, counter: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export const WEBAUTHN_CREDENTIAL_REPOSITORY = Symbol('WEBAUTHN_CREDENTIAL_REPOSITORY');
