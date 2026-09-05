import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessEvent } from '../entities/access-event.entity';
import {
  IAccessEventRepository,
  RecordEventData,
} from './access-event-repository.interface';

@Injectable()
export class AccessEventRepository implements IAccessEventRepository {
  constructor(
    @InjectRepository(AccessEvent)
    private readonly repository: Repository<AccessEvent>,
  ) {}

  record(data: RecordEventData): Promise<AccessEvent> {
    const event = this.repository.create(data);
    return this.repository.save(event);
  }
}
