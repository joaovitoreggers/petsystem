import { Component } from '@angular/core';
import { PetStateService } from './pet-state.service';
import { PetTechnicianComponent } from './technician/pet-technician.component';
import { PetManagerComponent } from './manager/pet-manager.component';
import { PetTeamComponent } from './team/pet-team.component';

@Component({
  selector: 'app-pet-shell',
  standalone: true,
  imports: [PetTechnicianComponent, PetManagerComponent, PetTeamComponent],
  templateUrl: './pet-shell.component.html',
  styleUrl: './pet-shell.component.scss',
})
export class PetShellComponent {
  constructor(readonly state: PetStateService) {}
}
