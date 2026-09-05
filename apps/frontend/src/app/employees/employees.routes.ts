import { Routes } from '@angular/router';

/**
 * Employees feature, lazy-loaded via loadChildren from app.routes.ts.
 */
export const employeesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./employees.component').then((m) => m.EmployeesComponent),
  },
];
