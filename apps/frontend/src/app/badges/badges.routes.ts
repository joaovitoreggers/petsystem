import { Routes } from '@angular/router';

/**
 * Badges feature, lazy-loaded via loadChildren from app.routes.ts.
 */
export const badgesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./badges.component').then((m) => m.BadgesComponent),
  },
];
