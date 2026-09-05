import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  UserSummary,
  UsersApiService,
} from '../core/services/users-api.service';

/**
 * CRUD de usuários — tela utilitária, propositalmente no mesmo estilo simples
 * do login/crachás enquanto o design definitivo não é feito.
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  readonly users = signal<UserSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly editingUser = signal<UserSummary | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  name = '';
  email = '';
  password = '';
  role = '';
  accessLevel = 1;

  constructor(private readonly usersApi: UsersApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
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

  openCreateForm(): void {
    this.editingUser.set(null);
    this.name = '';
    this.email = '';
    this.password = '';
    this.role = '';
    this.accessLevel = 1;
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditForm(user: UserSummary): void {
    this.editingUser.set(user);
    this.name = user.name;
    this.email = user.email;
    this.password = '';
    this.role = user.role;
    this.accessLevel = user.accessLevel;
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  save(): void {
    this.formError.set(null);
    this.saving.set(true);
    const editing = this.editingUser();

    const request = editing
      ? this.usersApi.update(editing.id, {
          name: this.name,
          email: this.email,
          role: this.role,
          accessLevel: Number(this.accessLevel),
          ...(this.password ? { password: this.password } : {}),
        })
      : this.usersApi.create({
          name: this.name,
          email: this.email,
          password: this.password,
          role: this.role,
          accessLevel: Number(this.accessLevel),
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.loadUsers();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this.extractErrorMessage(err));
      },
    });
  }

  remove(user: UserSummary): void {
    if (!confirm(`Excluir o usuário ${user.name}?`)) {
      return;
    }
    this.usersApi.delete(user.id).subscribe({
      next: () => this.loadUsers(),
      error: (err: HttpErrorResponse) => this.error.set(this.extractErrorMessage(err)),
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const message = err.error?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    return message ?? 'Não foi possível salvar o usuário.';
  }
}
