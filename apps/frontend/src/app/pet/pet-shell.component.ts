import { Component, computed, effect, signal } from '@angular/core';
import { PetStateService, PortalRole } from './pet-state.service';
import { PetTechnicianComponent } from './technician/pet-technician.component';
import { PetManagerComponent } from './manager/pet-manager.component';
import { PetTeamComponent } from './team/pet-team.component';
import { IconComponent, IconName } from '../shared/icon.component';
import { riskAreaNames, riskAreaNrs } from './pet-mock-data';

interface NavItem {
  id: PortalRole;
  label: string;
  shortLabel: string;
  description: string;
  icon: IconName;
  /** Contador exibido no item — `null` esconde o selo. */
  badge: () => number | null;
}

@Component({
  selector: 'app-pet-shell',
  standalone: true,
  imports: [
    PetTechnicianComponent,
    PetManagerComponent,
    PetTeamComponent,
    IconComponent,
  ],
  templateUrl: './pet-shell.component.html',
  styleUrl: './pet-shell.component.scss',
})
export class PetShellComponent {
  readonly navItems: NavItem[] = [
    {
      id: 'tecnico',
      label: 'Campo',
      shortLabel: 'Campo',
      description: 'Emissão e acompanhamento em campo',
      icon: 'field',
      badge: () => this.state.openPets().length || null,
    },
    {
      id: 'gestor',
      label: 'Painel de gestão',
      shortLabel: 'Painel',
      description: 'Monitoramento, análise e relatórios',
      icon: 'dashboard',
      badge: () => this.state.alarmedPets().length || null,
    },
    {
      id: 'equipe',
      label: 'Funcionários',
      shortLabel: 'Equipe',
      description: 'Cadastro e validade das NRs',
      icon: 'team',
      badge: () => null,
    },
  ];

  readonly currentNav = computed(
    () =>
      this.navItems.find((item) => item.id === this.state.role()) ??
      this.navItems[0],
  );

  // Confirmação antes de acionar a evacuação: ação irreversível na operação
  // (liga sirene e notifica brigada/portaria), então nunca em um clique só.
  readonly evacConfirmOpen = signal(false);
  readonly evacStartedAt = signal('');

  constructor(readonly state: PetStateService) {
    // Carimba o horário sempre que a evacuação começa — vale tanto para o
    // acionamento pelo shell quanto pelo banner de alerta do painel.
    effect(() => {
      if (this.state.evacuating()) {
        if (!this.evacStartedAt()) {
          this.evacStartedAt.set(
            new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          );
        }
      } else {
        this.evacStartedAt.set('');
      }
    });
  }

  openEvacConfirm(): void {
    this.evacConfirmOpen.set(true);
  }

  closeEvacConfirm(): void {
    this.evacConfirmOpen.set(false);
  }

  confirmEvacuation(): void {
    this.evacConfirmOpen.set(false);
    this.state.triggerEvacuation();
  }

  /**
   * O que a brigada precisa ler na tela de emergência, em ordem de urgência.
   * Quando há uma PET em alarme, os dados são os dela; num acionamento
   * manual (sem alarme atmosférico), mostra o retrato das frentes ativas.
   */
  readonly evacFacts = computed<{ label: string; value: string }[]>(() => {
    const pet = this.state.alarmedPets()[0];
    if (pet) {
      return [
        { label: 'Local', value: `${pet.location} · ${pet.unit}` },
        { label: 'Permissão', value: pet.id },
        {
          label: 'Área de risco',
          value: `${riskAreaNames(pet.areas)} · ${riskAreaNrs(pet.areas)}`,
        },
        { label: 'Pessoas na frente', value: `${pet.teamSize}` },
        { label: 'Responsável', value: pet.technician },
        { label: 'Coordenadas', value: pet.coordinates },
      ];
    }
    const open = this.state.openPets();
    const people = open.reduce((sum, p) => sum + p.teamSize, 0);
    const units = new Set(open.map((p) => p.unit)).size;
    return [
      { label: 'Frentes ativas', value: `${open.length}` },
      { label: 'Pessoas em campo', value: `${people}` },
      { label: 'Unidades envolvidas', value: `${units}` },
      { label: 'Acionamento', value: 'manual · SESMT' },
    ];
  });
}
