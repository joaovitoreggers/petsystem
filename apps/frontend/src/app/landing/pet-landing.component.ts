import { Component, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

function formatClock(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Landing comercial do PET Digital — porta de entrada pública, antes do
 * login. Puramente informativa: os CTAs de venda são âncoras dentro da
 * própria página, e "Entrar"/"Acessar o sistema" são os únicos links que
 * levam pra dentro do app de verdade (rota /pet).
 */
@Component({
  selector: 'app-pet-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pet-landing.component.html',
  styleUrl: './pet-landing.component.scss',
})
export class PetLandingComponent implements OnDestroy {
  readonly clockText = signal(formatClock());
  private readonly clockIntervalId = setInterval(() => this.clockText.set(formatClock()), 30000);

  ngOnDestroy(): void {
    clearInterval(this.clockIntervalId);
  }
}
