import { Injectable } from '@angular/core';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

/**
 * Encapsula o leitor de navegador do ZXing: decodifica continuamente
 * códigos QR a partir de um elemento de vídeo ao vivo e reporta cada
 * string decodificada com sucesso.
 */
@Injectable({ providedIn: 'root' })
export class QrCodeReaderService {
  private controls: IScannerControls | null = null;
  private readonly reader = new BrowserQRCodeReader();

  async start(
    video: HTMLVideoElement,
    onDecode: (text: string) => void,
  ): Promise<void> {
    this.controls = await this.reader.decodeFromVideoElement(video, (result) => {
      if (result) {
        onDecode(result.getText());
      }
    });
  }

  stop(): void {
    this.controls?.stop();
    this.controls = null;
  }
}
