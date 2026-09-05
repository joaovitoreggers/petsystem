export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  accessLevel: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  accessLevel: number;
}
