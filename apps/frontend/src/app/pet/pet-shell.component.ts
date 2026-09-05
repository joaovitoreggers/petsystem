import { Component } from '@angular/core';
import { PetStateService } from './pet-state.service';
import { PetTechnicianComponent } from './technician/pet-technician.component';
import { PetManagerComponent } from './manager/pet-manager.component';

@Component({
  selector: 'app-pet-shell',
  standalone: true,
  imports: [PetTechnicianComponent, PetManagerComponent],
  templateUrl: './pet-shell.component.html',
  styleUrl: './pet-shell.component.scss',
})
export class PetShellComponent {
  constructor(readonly state: PetStateService) {}
}
