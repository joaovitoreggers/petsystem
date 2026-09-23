import { Component, computed, effect, signal } from '@angular/core';
import { PetStateService, PortalRole } from './pet-state.service';
import { PetTechnicianComponent } from './technician/pet-technician.component';
import { PetManagerComponent } from './manager/pet-manager.component';
import { PetTeamComponent } from './team/pet-team.component';
import { PetLocationsComponent } from './locations/pet-locations.component';
import { PetUsersComponent } from './users/pet-users.component';
import { PetCompaniesComponent } from './companies/pet-companies.component';
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
    PetLocationsComponent,
    PetUsersComponent,
    PetCompaniesComponent,
    IconComponent,
  ],
  templateUrl: './pet-shell.component.html',
  styleUrl: './pet-shell.component.scss',
})
export class PetShellComponent {
  private readonly allNavItems: NavItem[] = [
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
    {
      id: 'locais',
      label: 'Locais',
      shortLabel: 'Locais',
      description: 'Cadastro de locais e áreas de risco',
      icon: 'pin',
      badge: () => null,
    },
    {
      id: 'usuarios',
      label: 'Usuários',
      shortLabel: 'Usuários',
      description: 'Contas de login e papéis de acesso',
      icon: 'shield',
      badge: () => null,
    },
    {
      id: 'empresas',
      label: 'Empresas',
      shortLabel: 'Empresas',
      description: 'Grupos de empresas e filiais (tenants)',
      icon: 'building',
      badge: () => null,
    },
  ];

  // "Usuários" só aparece com sessão de admin/gestor/platform-admin — a
  // mesma checagem que libera editar/excluir em Funcionários. "Empresas" é
  // mais restrita ainda: só platform-admin gerencia a estrutura de tenants.
  // O back-end (RolesGuard) é quem aplica de verdade; isto só evita
  // oferecer uma aba cujas rotas de escrita a API recusaria.
  readonly navItems = computed(() =>
    this.allNavItems.filter((item) => {
      if (item.id === 'empresas') return this.state.isPlatformAdmin();
      if (item.id === 'usuarios') return this.state.canManageTeam();
      return true;
    }),
  );

  readonly currentNav = computed(
    () =>
      this.navItems().find((item) => item.id === this.state.role()) ??
      this.navItems()[0],
  );

  readonly evacStartedAt = signal('');

  constructor(readonly state: PetStateService) {
    // Se a sessão de admin/gestor cair (logout, expiração) enquanto a aba
    // Usuários/Empresas está aberta, volta para Campo em vez de deixar o
    // conteúdo tentando carregar uma lista que a API não vai mais devolver.
    effect(() => {
      const role = this.state.role();
      if (role === 'usuarios' && !this.state.canManageTeam()) {
        this.state.setRole('tecnico');
      }
      if (role === 'empresas' && !this.state.isPlatformAdmin()) {
        this.state.setRole('tecnico');
      }
    });

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

  /**
   * O que a brigada precisa ler na tela de emergência, em ordem de urgência.
   * Segue a mesma PET que state.evacText() usa: a escolhida explicitamente
   * no seletor do painel de gestão, com fallback para a primeira em alarme;
   * num acionamento manual sem nenhuma das duas, mostra o retrato das
   * frentes ativas.
   */
  readonly evacFacts = computed<{ label: string; value: string }[]>(() => {
    const pet = this.state.evacuationPet();
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
