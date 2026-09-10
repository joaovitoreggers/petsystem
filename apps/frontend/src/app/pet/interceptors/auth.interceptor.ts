import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';

/**
 * Anexa o JWT (quando existe uma sessão de e-mail/senha) em toda chamada à
 * API — sem isso, PATCH/DELETE de funcionários (que exigem login real)
 * sempre voltariam 401.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthTokenService).getToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
