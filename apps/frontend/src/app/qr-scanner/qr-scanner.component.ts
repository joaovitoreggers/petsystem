import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ScannerState } from './scanner-state.types';
import { PersonDetectorService } from './services/person-detector.service';
import { QrCodeReaderService } from './services/qr-code-reader.service';
import { AttemptDto, QrValidationApiService } from './services/qr-validation-api.service';

const PERSON_CONFIDENCE_THRESHOLD = 0.6;

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.scss',
})
export class QrScannerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;

  readonly state = signal<ScannerState>({ type: 'idle' });

  private cameraStream: MediaStream | null = null;
  private processedCodes = new Set<string>();

  constructor(
    private readonly personDetector: PersonDetectorService,
    private readonly qrCodeReader: QrCodeReaderService,
    private readonly qrValidationApi: QrValidationApiService,
  ) {}

  ngAfterViewInit(): void {
    this.startFlow();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  restart(): void {
    this.processedCodes.clear();
    this.startFlow();
  }

  private async startFlow(): Promise<void> {
    try {
      this.state.set({ type: 'preparing_camera' });
      await this.activateCamera();

      this.state.set({ type: 'awaiting_detection' });
      const personCount = await this.personDetector.countPeople(
        this.videoRef.nativeElement,
        PERSON_CONFIDENCE_THRESHOLD,
      );

      const attempt = await firstValueFrom(this.qrValidationApi.startAttempt());
      const attemptWithDetection = await firstValueFrom(
        this.qrValidationApi.startDetection(attempt.id, Math.max(personCount, 1)),
      );

      this.applyAttempt(attemptWithDetection);
      await this.qrCodeReader.start(this.videoRef.nativeElement, (text) =>
        this.onQrDecoded(text),
      );
    } catch (error) {
      this.state.set({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to start the reading flow',
      });
    }
  }

  private async activateCamera(): Promise<void> {
    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    this.videoRef.nativeElement.srcObject = this.cameraStream;
    await this.videoRef.nativeElement.play();
  }

  private onQrDecoded(qrCode: string): void {
    const currentState = this.state();
    if (currentState.type !== 'awaiting_reads') {
      return;
    }
    if (this.processedCodes.has(qrCode)) {
      return;
    }
    this.processedCodes.add(qrCode);

    this.qrValidationApi.recordRead(currentState.attemptId, qrCode).subscribe({
      next: (attempt) => this.applyAttempt(attempt),
      error: () => {
        // Duplicidade (409) ou tentativa expirada: mantém o estado atual e
        // permite novas tentativas de leitura de outros códigos.
      },
    });
  }

  private applyAttempt(attempt: AttemptDto): void {
    switch (attempt.status) {
      case 'AWAITING_READS':
        this.state.set({
          type: 'awaiting_reads',
          attemptId: attempt.id,
          expectedCount: attempt.expectedCount,
          reads: attempt.reads,
        });
        break;
      case 'COMPLETE':
        this.qrCodeReader.stop();
        this.state.set({
          type: 'complete',
          reads: attempt.reads,
          finalResult: attempt.finalResult!,
        });
        break;
      case 'EXPIRED':
        this.qrCodeReader.stop();
        this.state.set({ type: 'expired' });
        break;
      default:
        break;
    }
  }

  private stopCamera(): void {
    this.qrCodeReader.stop();
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
  }
}
