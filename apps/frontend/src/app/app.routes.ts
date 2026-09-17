import { Route } from '@angular/router';
import { PetLandingComponent } from './landing/pet-landing.component';

export const appRoutes: Route[] = [
  { path: '', component: PetLandingComponent },
  { path: 'pet', loadChildren: () => import('./pet/pet.routes').then((m) => m.petRoutes) },
  { path: '**', redirectTo: '' },
];
