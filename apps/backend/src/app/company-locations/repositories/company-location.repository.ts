import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyLocation } from '../entities/company-location.entity';
import {
  CreateCompanyLocationData,
  ICompanyLocationRepository,
  UpdateCompanyLocationData,
} from './company-location-repository.interface';

@Injectable()
export class CompanyLocationRepository implements ICompanyLocationRepository {
  constructor(
    @InjectRepository(CompanyLocation)
    private readonly repository: Repository<CompanyLocation>,
  ) {}

  findAll(): Promise<CompanyLocation[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<CompanyLocation | null> {
    return this.repository.findOneBy({ id });
  }

  create(data: CreateCompanyLocationData): Promise<CompanyLocation> {
    const location = this.repository.create({
      name: data.name,
      riskAreas: data.riskAreas,
      unit: data.unit,
      companyGroupId: data.companyGroupId ?? null,
      branchId: data.branchId ?? null,
    });
    return this.repository.save(location);
  }

  async update(id: string, data: UpdateCompanyLocationData): Promise<CompanyLocation | null> {
    const location = await this.repository.findOneBy({ id });
    if (!location) {
      return null;
    }
    if (data.name !== undefined) location.name = data.name;
    if (data.riskAreas !== undefined) location.riskAreas = data.riskAreas;
    if (data.unit !== undefined) location.unit = data.unit;
    if (data.companyGroupId !== undefined) location.companyGroupId = data.companyGroupId;
    if (data.branchId !== undefined) location.branchId = data.branchId;
    return this.repository.save(location);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
