import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkPermit } from '../entities/work-permit.entity';
import { findGasViolations } from '../gas-limits';
import {
  AddReadingData,
  CloseWorkPermitData,
  CreateWorkPermitData,
  IWorkPermitRepository,
} from './work-permit-repository.interface';

@Injectable()
export class WorkPermitRepository implements IWorkPermitRepository {
  constructor(
    @InjectRepository(WorkPermit)
    private readonly repository: Repository<WorkPermit>,
  ) {}

  findAll(): Promise<WorkPermit[]> {
    return this.repository.find({ order: { date: 'DESC', start: 'DESC' } });
  }

  findById(id: string): Promise<WorkPermit | null> {
    return this.repository.findOneBy({ id });
  }

  async create(data: CreateWorkPermitData): Promise<WorkPermit> {
    const id = data.id ?? (await this.nextId());
    const permit = this.repository.create({
      id,
      areas: data.areas,
      location: data.location,
      unit: data.unit,
      teamSize: data.teamSize,
      date: data.date,
      start: data.start,
      end: data.end ?? '',
      timeLabel: data.timeLabel ?? data.start,
      technician: data.technician,
      status: data.status ?? 'aberta',
      coordinates: data.coordinates ?? '',
      gas: data.gas,
      alarm: data.alarm ?? false,
      durationMinutes: data.durationMinutes,
      criticalAlerts: data.criticalAlerts,
      team: data.team,
      companyPhone: data.companyPhone,
    });
    return this.repository.save(permit);
  }

  async close(id: string, data: CloseWorkPermitData): Promise<WorkPermit | null> {
    const permit = await this.repository.findOneBy({ id });
    if (!permit) {
      return null;
    }
    permit.status = 'fechada';
    permit.end = data.end;
    permit.durationMinutes = data.durationMinutes;
    permit.closeReason = data.reason;
    permit.closedBy = data.closedBy;
    return this.repository.save(permit);
  }

  async addReading(id: string, data: AddReadingData): Promise<WorkPermit | null> {
    const permit = await this.repository.findOneBy({ id });
    if (!permit) {
      return null;
    }
    const { o2, co, h2s, lel } = data.gas;
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const text = `O₂ ${o2.toFixed(1)}% · CO ${co.toFixed(0)} ppm · H₂S ${h2s.toFixed(1)} ppm · LEL ${lel.toFixed(0)}%`;
    const violations = findGasViolations(data.gas, time);
    permit.gas = data.gas;
    permit.readings = [...(permit.readings ?? []), { time, text }];
    permit.atmosphereAlerts = [...violations, ...(permit.atmosphereAlerts ?? [])];
    permit.alarm = violations.length > 0;
    return this.repository.save(permit);
  }

  private async nextId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PET-${year}-`;
    const rows = await this.repository.find({ select: ['id'] });
    const max = rows
      .map((row) => row.id)
      .filter((id) => id.startsWith(prefix))
      .map((id) => Number(id.slice(prefix.length)))
      .filter((n) => !Number.isNaN(n))
      .reduce((highest, n) => Math.max(highest, n), 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }
}
