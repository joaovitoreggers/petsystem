import { Route } from '@angular/router';
import { PetLandingComponent } from './landing/pet-landing.component';
import { PetEvacuationStatusComponent } from './pet/evacuation-status/pet-evacuation-status.component';

export const appRoutes: Route[] = [
  { path: '', component: PetLandingComponent },
  // Pública de propósito (sem o guard/shell de /pet) — é o link enviado
  // por SMS/WhatsApp na evacuação, aberto por quem pode nunca ter feito
  // login. Ver EvacuationController.publicStatus.
  { path: 'status/:id', component: PetEvacuationStatusComponent },
  { path: 'pet', loadChildren: () => import('./pet/pet.routes').then((m) => m.petRoutes) },
  { path: '**', redirectTo: '' },
];
