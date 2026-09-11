import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../tenancy/tenancy.module';
import { TeamMember } from './entities/team-member.entity';
import { TEAM_MEMBER_REPOSITORY } from './repositories/team-member-repository.interface';
import { TeamMemberRepository } from './repositories/team-member.repository';
import { TeamMembersController } from './team-members.controller';
import { TeamMembersService } from './team-members.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember]), TenancyModule],
  controllers: [TeamMembersController],
  providers: [
    { provide: TEAM_MEMBER_REPOSITORY, useClass: TeamMemberRepository },
    TeamMembersService,
  ],
  exports: [TeamMembersService],
})
export class TeamMembersModule {}
