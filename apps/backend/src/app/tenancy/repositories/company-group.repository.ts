import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyGroup } from '../entities/company-group.entity';
import {
  CreateCompanyGroupData,
  ICompanyGroupRepository,
  UpdateCompanyGroupData,
} from './company-group-repository.interface';

@Injectable()
export class CompanyGroupRepository implements ICompanyGroupRepository {
  constructor(
    @InjectRepository(CompanyGroup)
    private readonly repository: Repository<CompanyGroup>,
  ) {}

  findAll(): Promise<CompanyGroup[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<CompanyGroup | null> {
    return this.repository.findOneBy({ id });
  }

  create(data: CreateCompanyGroupData): Promise<CompanyGroup> {
    const group = this.repository.create({ id: randomUUID(), name: data.name });
    return this.repository.save(group);
  }

  async update(id: string, data: UpdateCompanyGroupData): Promise<CompanyGroup | null> {
    const group = await this.repository.findOneBy({ id });
    if (!group) {
      return null;
    }
    if (data.name !== undefined) group.name = data.name;
    return this.repository.save(group);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
