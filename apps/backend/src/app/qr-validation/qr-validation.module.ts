import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '../employees/employees.module';
import { AccessEvent } from './entities/access-event.entity';
import { ACCESS_EVENT_REPOSITORY } from './repositories/access-event-repository.interface';
import { AccessEventRepository } from './repositories/access-event.repository';
import { QrValidationController } from './qr-validation.controller';
import { QrValidationService } from './qr-validation.service';
import { AccessAttemptStoreService } from './access-attempt-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessEvent]), EmployeesModule],
  controllers: [QrValidationController],
  providers: [
    { provide: ACCESS_EVENT_REPOSITORY, useClass: AccessEventRepository },
    QrValidationService,
    AccessAttemptStoreService,
  ],
  exports: [QrValidationService],
})
export class QrValidationModule {}
