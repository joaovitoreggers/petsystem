import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EmployeeSummary,
  EmployeesApiService,
} from '../core/services/employees-api.service';

/**
 * CRUD de funcionários — pessoas de campo que carregam um crachá (QR) e são
 * validadas nas tentativas de entrada. Não são necessariamente Usuários
 * (não fazem login). As duas permissões são independentes uma da outra.
 *
 * Tela utilitária, propositalmente no mesmo estilo simples do login/crachás
 * enquanto o design definitivo não é feito.
 */
@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss',
})
export class EmployeesComponent implements OnInit {
  readonly employees = signal<EmployeeSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly editingEmployee = signal<EmployeeSummary | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  name = '';
  role = '';
  canAccessRiskAreas = false;
  canPerformCorrectiveService = false;

  constructor(private readonly employeesApi: EmployeesApiService) {}

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.loading.set(true);
    this.error.set(null);
    this.employeesApi.findAll().subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar a lista de funcionários.');
        this.loading.set(false);
      },
    });
  }

  openCreateForm(): void {
    this.editingEmployee.set(null);
    this.name = '';
    this.role = '';
    this.canAccessRiskAreas = false;
    this.canPerformCorrectiveService = false;
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditForm(employee: EmployeeSummary): void {
    this.editingEmployee.set(employee);
    this.name = employee.name;
    this.role = employee.role;
    this.canAccessRiskAreas = employee.canAccessRiskAreas;
    this.canPerformCorrectiveService = employee.canPerformCorrectiveService;
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  save(): void {
    this.formError.set(null);
    this.saving.set(true);
    const editing = this.editingEmployee();

    const payload = {
      name: this.name,
      role: this.role,
      canAccessRiskAreas: this.canAccessRiskAreas,
      canPerformCorrectiveService: this.canPerformCorrectiveService,
    };

    const request = editing
      ? this.employeesApi.update(editing.id, payload)
      : this.employeesApi.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.loadEmployees();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this.extractErrorMessage(err));
      },
    });
  }

  remove(employee: EmployeeSummary): void {
    if (!confirm(`Excluir o funcionário ${employee.name}?`)) {
      return;
    }
    this.employeesApi.delete(employee.id).subscribe({
      next: () => this.loadEmployees(),
      error: (err: HttpErrorResponse) => this.error.set(this.extractErrorMessage(err)),
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const message = err.error?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    return message ?? 'Não foi possível salvar o funcionário.';
  }
}
