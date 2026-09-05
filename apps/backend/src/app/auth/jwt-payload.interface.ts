export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  accessLevel: number;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
  accessLevel: number;
}
