import { Component, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

function formatClock(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const WHATSAPP_NUMBER = '5545999894283';
const WHATSAPP_MESSAGE = 'Olá! Vim pelo site do PET Digital e gostaria de agendar uma demonstração.';

/**
 * Landing comercial do PET Digital — porta de entrada pública, antes do
 * login. "Entrar"/"Acessar o sistema" levam pra dentro do app de verdade
 * (rota /pet); "Agendar demonstração"/"Falar no WhatsApp" abrem uma
 * conversa real (wa.me), não uma âncora — é o único canal de contato que
 * a página oferece, de propósito, sem formulário fingindo capturar lead.
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
  readonly whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  private readonly clockIntervalId = setInterval(() => this.clockText.set(formatClock()), 30000);

  ngOnDestroy(): void {
    clearInterval(this.clockIntervalId);
  }
}
