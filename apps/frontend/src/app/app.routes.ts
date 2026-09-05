import { Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadChildren: () => import('./auth/auth.routes').then((m) => m.authRoutes) },
  {
    path: 'scanner',
    canActivate: [authGuard],
    loadChildren: () => import('./qr-scanner/qr-scanner.routes').then((m) => m.qrScannerRoutes),
  },
  { path: '**', redirectTo: 'login' },
];
