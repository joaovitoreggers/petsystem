import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { EMERGENCY_CONTACT_REPOSITORY } from './repositories/emergency-contact-repository.interface';
import { EmergencyContactRepository } from './repositories/emergency-contact.repository';
import { EmergencyContactsController } from './emergency-contacts.controller';
import { EmergencyContactsService } from './emergency-contacts.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmergencyContact])],
  controllers: [EmergencyContactsController],
  providers: [
    { provide: EMERGENCY_CONTACT_REPOSITORY, useClass: EmergencyContactRepository },
    EmergencyContactsService,
  ],
  exports: [EmergencyContactsService],
})
export class EmergencyContactsModule {}
