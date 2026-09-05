import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard pattern: protects routes by requiring a valid JWT (delegates to JwtStrategy).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
