import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebAuthnCredential } from '../entities/webauthn-credential.entity';
import {
  CreateWebAuthnCredentialData,
  IWebAuthnCredentialRepository,
} from './webauthn-credential-repository.interface';

@Injectable()
export class WebAuthnCredentialRepository implements IWebAuthnCredentialRepository {
  constructor(
    @InjectRepository(WebAuthnCredential)
    private readonly repository: Repository<WebAuthnCredential>,
  ) {}

  findById(id: string): Promise<WebAuthnCredential | null> {
    return this.repository.findOneBy({ id });
  }

  findByUserId(userId: string): Promise<WebAuthnCredential[]> {
    return this.repository.findBy({ userId });
  }

  async create(data: CreateWebAuthnCredentialData): Promise<WebAuthnCredential> {
    const credential = this.repository.create({
      id: data.id,
      userId: data.userId,
      publicKey: data.publicKey,
      counter: data.counter,
      deviceType: data.deviceType,
      backedUp: data.backedUp,
      transports: data.transports,
      lastUsedAt: null,
    });
    return this.repository.save(credential);
  }

  async updateCounter(id: string, counter: number): Promise<void> {
    await this.repository.update(id, { counter, lastUsedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
