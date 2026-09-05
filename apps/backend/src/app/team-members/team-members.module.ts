import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMember } from './entities/team-member.entity';
import { TEAM_MEMBER_REPOSITORY } from './repositories/team-member-repository.interface';
import { TeamMemberRepository } from './repositories/team-member.repository';
import { TeamMembersController } from './team-members.controller';
import { TeamMembersService } from './team-members.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember])],
  controllers: [TeamMembersController],
  providers: [
    { provide: TEAM_MEMBER_REPOSITORY, useClass: TeamMemberRepository },
    TeamMembersService,
  ],
  exports: [TeamMembersService],
})
export class TeamMembersModule {}
