import { TeamMember } from '../entities/team-member.entity';

export interface CreateTeamMemberData {
  registration: string;
  name: string;
  role: string;
  company: string;
  unit: string;
  isThirdParty?: boolean;
  documents: Record<string, string>;
}

/**
 * Repository pattern: isolates data access for TeamMember from the ORM
 * choice. Only TeamMembersModule may depend on this token; other modules
 * go through TeamMembersService.
 */
export interface ITeamMemberRepository {
  findAll(): Promise<TeamMember[]>;
  findByRegistration(registration: string): Promise<TeamMember | null>;
  create(data: CreateTeamMemberData): Promise<TeamMember>;
}

export const TEAM_MEMBER_REPOSITORY = Symbol('TEAM_MEMBER_REPOSITORY');
