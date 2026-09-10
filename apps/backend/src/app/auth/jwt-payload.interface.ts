export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  companyGroupId?: string | null;
  branchId?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  companyGroupId?: string | null;
  branchId?: string | null;
}
