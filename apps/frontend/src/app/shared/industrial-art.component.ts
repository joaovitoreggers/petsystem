import { Component, Input } from '@angular/core';

export type IndustrialScene = 'plant' | 'confined' | 'shield' | 'clipboard';

/**
 * Arte industrial vetorial do sistema.
 *
 * Volume e profundidade em SVG isométrico — faces com iluminação diferente,
 * sombra projetada e planos sobrepostos — em vez de WebGL: o efeito
 * tridimensional aparece no login e nos estados vazios sem custar uma
 * dependência 3D, sem travar a operação em celular de campo e sem depender
 * de download de imagem (a planta funciona offline, como o resto do app).
 *
 * As cores saem dos tokens da marca (`--color-accent-*`), então a arte
 * acompanha a identidade sem valor fixo espalhado pelos templates.
 */
@Component({
  selector: 'app-industrial-art',
  standalone: true,
  template: `
    @switch (scene) {
      @case ('plant') {
        <!-- Planta industrial isométrica: silos, tanque, tubulação e galpão -->
        <svg viewBox="0 0 320 220" fill="none" aria-hidden="true" class="art">
          <defs>
            <linearGradient id="face-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--art-light)" />
              <stop offset="1" stop-color="var(--art-mid)" />
            </linearGradient>
            <linearGradient id="face-dark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="var(--art-mid)" />
              <stop offset="1" stop-color="var(--art-dark)" />
            </linearGradient>
            <radialGradient id="ground-glow" cx="0.5" cy="0.5" r="0.5">
              <stop
                offset="0"
                stop-color="var(--art-glow)"
                stop-opacity="0.55"
              />
              <stop offset="1" stop-color="var(--art-glow)" stop-opacity="0" />
            </radialGradient>
          </defs>

          <ellipse
            cx="160"
            cy="176"
            rx="140"
            ry="34"
            fill="url(#ground-glow)"
          />

          <!-- grade do piso, dando o plano de fundo -->
          <g stroke="var(--art-line)" stroke-width="0.7" opacity="0.4">
            <path d="M40 176 160 116 280 176 160 236Z" />
            <path d="M100 146 220 206M220 146 100 206" />
          </g>

          <!-- galpão ao fundo -->
          <g>
            <path
              d="M196 128v-26l40-20 40 20v26l-40 20Z"
              fill="url(#face-dark)"
            />
            <path d="M196 102l40-20 40 20-40 20Z" fill="url(#face-light)" />
            <path d="M236 122v26" stroke="var(--art-line)" stroke-width="0.8" />
          </g>

          <!-- silo alto -->
          <g>
            <path
              d="M92 152V74a24 12 0 0 1 48 0v78a24 12 0 0 1-48 0Z"
              fill="url(#face-dark)"
            />
            <ellipse cx="116" cy="74" rx="24" ry="12" fill="url(#face-light)" />
            <path
              d="M92 74a24 12 0 0 0 48 0"
              stroke="var(--art-line)"
              stroke-width="0.8"
            />
            <path
              d="M92 104h48M92 128h48"
              stroke="var(--art-line)"
              stroke-width="0.8"
              opacity="0.7"
            />
            <!-- cone superior, o "chapéu" do silo -->
            <path
              d="M96 72 116 52l20 20Z"
              fill="var(--art-accent)"
              opacity="0.9"
            />
          </g>

          <!-- silo baixo -->
          <g>
            <path
              d="M50 162v-46a17 9 0 0 1 34 0v46a17 9 0 0 1-34 0Z"
              fill="url(#face-dark)"
            />
            <ellipse cx="67" cy="116" rx="17" ry="9" fill="url(#face-light)" />
            <path
              d="M50 138h34"
              stroke="var(--art-line)"
              stroke-width="0.8"
              opacity="0.7"
            />
          </g>

          <!-- tanque horizontal -->
          <g>
            <path
              d="M162 168v-24a1 1 0 0 1 0 0h44v24Z"
              fill="url(#face-dark)"
            />
            <path d="M162 144h44l10-8h-44Z" fill="url(#face-light)" />
            <path d="M206 144v24l10-8v-24Z" fill="var(--art-dark)" />
            <path
              d="M174 144v24M190 144v24"
              stroke="var(--art-line)"
              stroke-width="0.8"
              opacity="0.6"
            />
          </g>

          <!-- tubulação ligando silo e tanque -->
          <g
            stroke="var(--art-accent)"
            stroke-width="3"
            stroke-linecap="round"
            opacity="0.95"
          >
            <path d="M140 132h14v22h8" />
          </g>
          <g fill="var(--art-accent)">
            <circle cx="154" cy="132" r="2.6" />
            <circle cx="154" cy="154" r="2.6" />
          </g>

          <!-- escada de acesso -->
          <g stroke="var(--art-line)" stroke-width="1" opacity="0.8">
            <path d="M86 150V84M78 150V84" />
            <path d="M78 96h8M78 108h8M78 120h8M78 132h8M78 144h8" />
          </g>

          <!-- partículas discretas: sensores/telemetria no ar -->
          <g fill="var(--art-accent)" opacity="0.55">
            <circle cx="256" cy="56" r="2" />
            <circle cx="276" cy="74" r="1.4" />
            <circle cx="44" cy="66" r="1.6" />
            <circle cx="292" cy="110" r="1.8" />
            <circle cx="28" cy="112" r="1.2" />
          </g>
        </svg>
      }

      @case ('confined') {
        <!-- Espaço confinado: boca de visita, vigia e detector -->
        <svg viewBox="0 0 200 160" fill="none" aria-hidden="true" class="art">
          <ellipse
            cx="100"
            cy="128"
            rx="82"
            ry="20"
            fill="var(--art-glow)"
            opacity="0.4"
          />
          <path
            d="M34 120V64a66 26 0 0 1 132 0v56a66 26 0 0 1-132 0Z"
            fill="var(--art-dark)"
            opacity="0.85"
          />
          <ellipse cx="100" cy="64" rx="66" ry="26" fill="var(--art-mid)" />
          <ellipse cx="100" cy="64" rx="34" ry="13" fill="var(--art-dark)" />
          <ellipse
            cx="100"
            cy="62"
            rx="34"
            ry="13"
            fill="none"
            stroke="var(--art-accent)"
            stroke-width="2.4"
          />
          <g stroke="var(--art-line)" stroke-width="1" opacity="0.7">
            <path d="M34 92a66 26 0 0 0 132 0" />
          </g>
          <!-- tripé de resgate -->
          <g
            stroke="var(--art-accent)"
            stroke-width="2.6"
            stroke-linecap="round"
          >
            <path d="M100 16 74 62M100 16l26 46M100 16v34" />
          </g>
          <circle cx="100" cy="14" r="4" fill="var(--art-accent)" />
        </svg>
      }

      @case ('shield') {
        <!-- Barreira de segurança: escudo com camadas em profundidade -->
        <svg viewBox="0 0 160 170" fill="none" aria-hidden="true" class="art">
          <path
            d="M80 158c30-11 50-38 50-71V33L80 14 30 33v54c0 33 20 60 50 71Z"
            fill="var(--art-dark)"
            opacity="0.5"
          />
          <path
            d="M80 148c25-9 42-32 42-60V40L80 24 38 40v48c0 28 17 51 42 60Z"
            fill="var(--art-mid)"
          />
          <path
            d="M80 24 38 40v48c0 28 17 51 42 60Z"
            fill="var(--art-light)"
            opacity="0.55"
          />
          <path
            d="m62 86 14 15 26-30"
            stroke="var(--art-accent)"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      }

      @case ('clipboard') {
        <!-- Estado vazio de listas de permissão -->
        <svg viewBox="0 0 160 160" fill="none" aria-hidden="true" class="art">
          <ellipse
            cx="80"
            cy="140"
            rx="52"
            ry="12"
            fill="var(--art-glow)"
            opacity="0.5"
          />
          <rect
            x="34"
            y="24"
            width="92"
            height="112"
            rx="8"
            fill="var(--art-mid)"
          />
          <rect
            x="44"
            y="14"
            width="72"
            height="24"
            rx="7"
            fill="var(--art-dark)"
          />
          <rect
            x="58"
            y="8"
            width="44"
            height="16"
            rx="6"
            fill="var(--art-accent)"
          />
          <g
            stroke="var(--art-line)"
            stroke-width="4"
            stroke-linecap="round"
            opacity="0.75"
          >
            <path d="M52 62h56M52 82h56M52 102h34" />
          </g>
        </svg>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        /* Paleta local derivada dos tokens da marca; o tema escuro do login
           reaproveita o mesmo componente trocando estas variáveis. */
        --art-light: var(--color-accent-300);
        --art-mid: var(--color-accent-500);
        --art-dark: var(--color-accent-800);
        --art-line: var(--color-accent-200);
        --art-accent: var(--color-accent-300);
        --art-glow: var(--color-accent-400);
      }
      .art {
        display: block;
        width: 100%;
        height: auto;
      }
    `,
  ],
})
export class IndustrialArtComponent {
  @Input({ required: true }) scene!: IndustrialScene;
}
