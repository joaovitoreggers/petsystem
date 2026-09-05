import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'pet' },
  { path: 'pet', loadChildren: () => import('./pet/pet.routes').then((m) => m.petRoutes) },
  { path: '**', redirectTo: 'pet' },
];
