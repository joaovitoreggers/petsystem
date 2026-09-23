import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyContactsModule } from '../emergency-contacts/emergency-contacts.module';
import { WorkPermitsModule } from '../work-permits/work-permits.module';
import { EvacuationAlert } from './entities/evacuation-alert.entity';
import { EvacuationController } from './evacuation.controller';
import { EvacuationService } from './evacuation.service';
import { NotificationsService } from './notifications.service';
import { EVACUATION_ALERT_REPOSITORY } from './repositories/evacuation-alert-repository.interface';
import { EvacuationAlertRepository } from './repositories/evacuation-alert.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EvacuationAlert]), WorkPermitsModule, EmergencyContactsModule],
  controllers: [EvacuationController],
  providers: [
    { provide: EVACUATION_ALERT_REPOSITORY, useClass: EvacuationAlertRepository },
    EvacuationService,
    NotificationsService,
  ],
})
export class EvacuationModule {}
