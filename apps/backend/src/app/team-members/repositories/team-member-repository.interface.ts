import { TeamMember } from '../entities/team-member.entity';

export interface CreateTeamMemberData {
  registration: string;
  name: string;
  role: string;
  company: string;
  unit: string;
  companyGroupId?: string | null;
  branchId?: string | null;
  isThirdParty?: boolean;
  documents: Record<string, string>;
}

export interface UpdateTeamMemberData {
  name?: string;
  role?: string;
  company?: string;
  unit?: string;
  companyGroupId?: string | null;
  branchId?: string | null;
  isThirdParty?: boolean;
  documents?: Record<string, string>;
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
  update(registration: string, data: UpdateTeamMemberData): Promise<TeamMember | null>;
  delete(registration: string): Promise<boolean>;
}

export const TEAM_MEMBER_REPOSITORY = Symbol('TEAM_MEMBER_REPOSITORY');
