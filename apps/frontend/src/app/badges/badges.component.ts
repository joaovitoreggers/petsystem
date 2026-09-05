import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import * as QRCode from 'qrcode';
import {
  EmployeeSummary,
  EmployeesApiService,
} from '../core/services/employees-api.service';

/**
 * Tela utilitária: lista os funcionários de teste e gera um crachá temporário
 * (nome + papel + QR code) para apontar a câmera do QrScanner enquanto o
 * design definitivo do crachá físico não existe. É o funcionário — não o
 * usuário de login — quem carrega o crachá validado nas tentativas de entrada.
 */
@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badges.component.html',
  styleUrl: './badges.component.scss',
})
export class BadgesComponent implements OnInit {
  readonly employees = signal<EmployeeSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedEmployee = signal<EmployeeSummary | null>(null);
  readonly qrDataUrl = signal<string | null>(null);

  constructor(private readonly employeesApi: EmployeesApiService) {}

  ngOnInit(): void {
    this.loading.set(true);
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

  async generateBadge(employee: EmployeeSummary): Promise<void> {
    this.selectedEmployee.set(employee);
    // O QR do crachá é o próprio id (uuid) do funcionário — nunca muda, então
    // uma edição futura no cadastro não invalida um crachá já gerado.
    this.qrDataUrl.set(await QRCode.toDataURL(employee.id, { margin: 1, width: 240 }));
  }

  closeBadge(): void {
    this.selectedEmployee.set(null);
    this.qrDataUrl.set(null);
  }
}
