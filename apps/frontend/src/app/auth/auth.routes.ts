import { Routes } from '@angular/router';

/**
 * Auth feature, lazy-loaded via loadChildren from app.routes.ts.
 * (Angular's standalone APIs replace NgModule for code-splitting purposes;
 * this routes file plays the same lazy-loading role an AuthModule would.)
 */
export const authRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
];
