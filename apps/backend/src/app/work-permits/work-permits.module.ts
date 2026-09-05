import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkPermit } from './entities/work-permit.entity';
import { WORK_PERMIT_REPOSITORY } from './repositories/work-permit-repository.interface';
import { WorkPermitRepository } from './repositories/work-permit.repository';
import { WorkPermitsController } from './work-permits.controller';
import { WorkPermitsService } from './work-permits.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkPermit])],
  controllers: [WorkPermitsController],
  providers: [
    { provide: WORK_PERMIT_REPOSITORY, useClass: WorkPermitRepository },
    WorkPermitsService,
  ],
  exports: [WorkPermitsService],
})
export class WorkPermitsModule {}
