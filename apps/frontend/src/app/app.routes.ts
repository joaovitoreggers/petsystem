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
  {
    path: 'badges',
    canActivate: [authGuard],
    loadChildren: () => import('./badges/badges.routes').then((m) => m.badgesRoutes),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadChildren: () => import('./users/users.routes').then((m) => m.usersRoutes),
  },
  {
    path: 'employees',
    canActivate: [authGuard],
    loadChildren: () => import('./employees/employees.routes').then((m) => m.employeesRoutes),
  },
  {
    path: 'pet',
    canActivate: [authGuard],
    loadChildren: () => import('./pet/pet.routes').then((m) => m.petRoutes),
  },
  { path: '**', redirectTo: 'login' },
];
