import { Routes } from '@angular/router';

/**
 * Users feature, lazy-loaded via loadChildren from app.routes.ts.
 */
export const usersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./users.component').then((m) => m.UsersComponent),
  },
];
