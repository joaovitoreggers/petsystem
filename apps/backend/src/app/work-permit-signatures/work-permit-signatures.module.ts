import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamMembersModule } from '../team-members/team-members.module';
import { UsersModule } from '../users/users.module';
import { WorkPermitSignature } from './entities/work-permit-signature.entity';
import { WORK_PERMIT_SIGNATURE_REPOSITORY } from './repositories/work-permit-signature-repository.interface';
import { WorkPermitSignatureRepository } from './repositories/work-permit-signature.repository';
import { WorkPermitSignaturesController } from './work-permit-signatures.controller';
import { WorkPermitSignaturesService } from './work-permit-signatures.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkPermitSignature]),
    AuthModule,
    UsersModule,
    TeamMembersModule,
    NotificationsModule,
  ],
  controllers: [WorkPermitSignaturesController],
  providers: [
    { provide: WORK_PERMIT_SIGNATURE_REPOSITORY, useClass: WorkPermitSignatureRepository },
    WorkPermitSignaturesService,
  ],
  exports: [WorkPermitSignaturesService],
})
export class WorkPermitSignaturesModule {}
