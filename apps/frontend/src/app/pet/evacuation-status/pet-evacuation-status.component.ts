import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EvacuationApiService, PublicEvacuationStatus } from '../services/evacuation-api.service';
import { RiskAreaId, riskAreaNames, riskAreaNrs } from '../pet-mock-data';

const POLL_INTERVAL_MS = 20000;

/**
 * Página pública (sem login) aberta pelo link do SMS/WhatsApp de
 * evacuação — quem abre pode nunca ter feito login no sistema. Atualiza
 * sozinha enquanto a evacuação segue em aberto; para de repetir assim que
 * `resolvedAt` chega. Ver EvacuationController.publicStatus.
 */
@Component({
  selector: 'app-pet-evacuation-status',
  standalone: true,
  imports: [],
  templateUrl: './pet-evacuation-status.component.html',
  styleUrl: './pet-evacuation-status.component.scss',
})
export class PetEvacuationStatusComponent implements OnInit, OnDestroy {
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly status = signal<PublicEvacuationStatus | null>(null);

  private pollId: ReturnType<typeof setInterval> | null = null;
  private alertId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly evacuationApi: EvacuationApiService,
  ) {}

  ngOnInit(): void {
    this.alertId = this.route.snapshot.paramMap.get('id') ?? '';
    this.refresh();
    this.pollId = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollId !== null) clearInterval(this.pollId);
  }

  private async refresh(): Promise<void> {
    if (!this.alertId) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
    try {
      const status = await firstValueFrom(this.evacuationApi.publicStatus(this.alertId));
      this.status.set(status);
      this.notFound.set(false);
      if (status.resolvedAt && this.pollId !== null) {
        clearInterval(this.pollId);
        this.pollId = null;
      }
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  readonly areaNames = computed(() => {
    const permit = this.status()?.workPermit;
    if (!permit) return '';
    return riskAreaNames(permit.areas as RiskAreaId[]);
  });

  readonly areaNrs = computed(() => {
    const permit = this.status()?.workPermit;
    if (!permit) return '';
    return riskAreaNrs(permit.areas as RiskAreaId[]);
  });

  readonly triggeredAtLabel = computed(() => {
    const iso = this.status()?.triggeredAt;
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });

  readonly resolvedAtLabel = computed(() => {
    const iso = this.status()?.resolvedAt;
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });
}
