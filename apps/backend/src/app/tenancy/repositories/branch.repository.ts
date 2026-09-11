import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { CreateBranchData, IBranchRepository } from './branch-repository.interface';

@Injectable()
export class BranchRepository implements IBranchRepository {
  constructor(
    @InjectRepository(Branch)
    private readonly repository: Repository<Branch>,
  ) {}

  findAll(): Promise<Branch[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Branch | null> {
    return this.repository.findOneBy({ id });
  }

  findByCompanyGroup(companyGroupId: string): Promise<Branch[]> {
    return this.repository.find({
      where: { companyGroupId },
      order: { name: 'ASC' },
    });
  }

  create(data: CreateBranchData): Promise<Branch> {
    const branch = this.repository.create({
      id: randomUUID(),
      companyGroupId: data.companyGroupId,
      name: data.name,
    });
    return this.repository.save(branch);
  }
}
