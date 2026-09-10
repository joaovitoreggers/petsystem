import { Component, Input } from '@angular/core';

/**
 * Conjunto de ícones do sistema.
 *
 * Um único componente com um `@switch` em vez de `innerHTML` + sanitizer:
 * mantém os SVGs no template (sem bypass de segurança), garante traço,
 * tamanho e alinhamento iguais em toda a interface e evita que cada tela
 * invente o próprio desenho. `currentColor` faz o ícone herdar a cor do
 * contexto (nav ativo, botão perigoso, estado crítico…).
 */
export type IconName =
  | 'field'
  | 'dashboard'
  | 'team'
  | 'alert'
  | 'check'
  | 'close'
  | 'arrow-left'
  | 'plus'
  | 'clock'
  | 'pin'
  | 'gauge'
  | 'shield'
  | 'document'
  | 'sparkles'
  | 'camera'
  | 'qr'
  | 'logout'
  | 'search'
  | 'pencil'
  | 'trash'
  | 'building';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      class="icon"
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name) {
        @case ('field') {
          <!-- capacete de segurança — o técnico em campo -->
          <path d="M3 16a9 9 0 0 1 18 0" />
          <path
            d="M9.5 16V7.6a1.6 1.6 0 0 1 1.6-1.6h1.8a1.6 1.6 0 0 1 1.6 1.6V16"
          />
          <path
            d="M2 16h20v1.6a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 17.6Z"
          />
        }
        @case ('dashboard') {
          <rect x="3" y="3" width="7.5" height="8.5" rx="1.3" />
          <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.3" />
          <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.3" />
          <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.3" />
        }
        @case ('team') {
          <circle cx="9" cy="8" r="3.2" />
          <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
          <path d="M16.5 5.6a3.2 3.2 0 0 1 0 6.1" />
          <path d="M18 14.4a6.2 6.2 0 0 1 3.2 5.6" />
        }
        @case ('alert') {
          <path
            d="M10.3 3.6 2.5 17.2A2 2 0 0 0 4.2 20.2h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"
          />
          <path d="M12 9v4.2" />
          <path d="M12 16.8h.01" />
        }
        @case ('check') {
          <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
        }
        @case ('close') {
          <path d="M6 6 18 18M18 6 6 18" />
        }
        @case ('arrow-left') {
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5.4l3.4 2" />
        }
        @case ('pin') {
          <path
            d="M19 10.2c0 5.1-7 11.3-7 11.3s-7-6.2-7-11.3a7 7 0 0 1 14 0Z"
          />
          <circle cx="12" cy="10" r="2.6" />
        }
        @case ('gauge') {
          <path d="M4 18a9 9 0 1 1 16 0" />
          <path d="m12 14 4-4" />
          <circle cx="12" cy="14" r="1.4" />
        }
        @case ('shield') {
          <path
            d="M12 2.8 4.8 5.6v5.8c0 4.6 3 8.4 7.2 9.8 4.2-1.4 7.2-5.2 7.2-9.8V5.6Z"
          />
          <path d="m8.9 12.2 2.2 2.2 4-4.2" />
        }
        @case ('document') {
          <path
            d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8Z"
          />
          <path d="M14 2.8v5h5" />
          <path d="M8.6 13h6.8M8.6 16.6h4.4" />
        }
        @case ('sparkles') {
          <path
            d="M12 3.2 13.7 8l4.8 1.7-4.8 1.7L12 16.2l-1.7-4.8L5.5 9.7 10.3 8Z"
          />
          <path
            d="M18.6 15.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z"
          />
        }
        @case ('camera') {
          <path
            d="M3.8 7.8h3l1.4-2.2h5.6L15.2 7.8h5a1.8 1.8 0 0 1 1.8 1.8v8.2a1.8 1.8 0 0 1-1.8 1.8H3.8A1.8 1.8 0 0 1 2 17.8V9.6a1.8 1.8 0 0 1 1.8-1.8Z"
          />
          <circle cx="12" cy="13.4" r="3.4" />
        }
        @case ('qr') {
          <rect x="3.2" y="3.2" width="7" height="7" rx="1.2" />
          <rect x="13.8" y="3.2" width="7" height="7" rx="1.2" />
          <rect x="3.2" y="13.8" width="7" height="7" rx="1.2" />
          <path d="M13.8 13.8h3v3h-3zM20.8 13.8v3M17.8 20.8h3M13.8 20.8h.01" />
        }
        @case ('logout') {
          <path d="M14.6 3.8h3.6a2 2 0 0 1 2 2v12.4a2 2 0 0 1-2 2h-3.6" />
          <path d="M9.6 15.6 13.2 12 9.6 8.4" />
          <path d="M13.2 12H3.8" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="6.4" />
          <path d="m20 20-4.4-4.4" />
        }
        @case ('pencil') {
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        }
        @case ('trash') {
          <path d="M3.5 6h17" />
          <path d="M18.5 6v14a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6" />
          <path d="M8.5 6V4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
          <path d="M10.2 11v6M13.8 11v6" />
        }
        @case ('building') {
          <rect x="4" y="3" width="12" height="18" rx="1" />
          <path d="M16 9h4v12h-4" />
          <path d="M7.5 7h1M11.5 7h1M7.5 11h1M11.5 11h1M7.5 15h1M11.5 15h1" />
          <path d="M9 21v-3.5" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        line-height: 0;
      }
      .icon {
        display: block;
      }
    `,
  ],
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
  @Input() size = 18;
}
