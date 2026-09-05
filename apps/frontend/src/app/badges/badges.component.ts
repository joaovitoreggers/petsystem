import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import * as QRCode from 'qrcode';
import { UserSummary, UsersApiService } from './services/users-api.service';

/**
 * Tela utilitária: lista os usuários de teste e gera um crachá temporário
 * (nome + papel + QR code) para apontar a câmera do QrScanner enquanto o
 * design definitivo do crachá físico não existe.
 */
@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badges.component.html',
  styleUrl: './badges.component.scss',
})
export class BadgesComponent implements OnInit {
  readonly users = signal<UserSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedUser = signal<UserSummary | null>(null);
  readonly qrDataUrl = signal<string | null>(null);

  constructor(private readonly usersApi: UsersApiService) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.usersApi.findAll().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar a lista de usuários.');
        this.loading.set(false);
      },
    });
  }

  async generateBadge(user: UserSummary): Promise<void> {
    this.selectedUser.set(user);
    this.qrDataUrl.set(await QRCode.toDataURL(user.qrCode, { margin: 1, width: 240 }));
  }

  closeBadge(): void {
    this.selectedUser.set(null);
    this.qrDataUrl.set(null);
  }
}
