import { Injectable } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';

// Distância euclidiana abaixo da qual o face-api.js considera "mesma
// pessoa" para o FaceRecognitionNet padrão — valor recomendado pela
// própria biblioteca, não um ajuste nosso.
const MATCH_THRESHOLD = 0.6;

/**
 * Reconhecimento facial de verdade, rodando inteiro no navegador
 * (@vladmandic/face-api sobre TensorFlow.js — modelos em
 * assets/face-models/, baixados uma vez e cacheados pelo browser). Nenhuma
 * imagem nem descritor sai do dispositivo por aqui: quem decide o que
 * fazer com o descritor capturado é o chamador (ver PetStateService).
 */
@Injectable({ providedIn: 'root' })
export class FaceRecognitionService {
  private modelsLoadingPromise: Promise<void> | null = null;

  private async ensureModelsLoaded(): Promise<void> {
    if (!this.modelsLoadingPromise) {
      const url = 'assets/face-models';
      this.modelsLoadingPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ]).then(() => undefined);
    }
    await this.modelsLoadingPromise;
  }

  /**
   * Detecta um único rosto no frame atual do vídeo e devolve seu
   * descritor (vetor de 128 números) — `null` se nenhum rosto for
   * encontrado. O descritor não pode ser revertido numa imagem; é só o
   * suficiente para comparar "é a mesma pessoa?" via distância euclidiana.
   */
  async captureDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
    // Um vídeo sem frame decodificado ainda (srcObject não atribuído a
    // tempo, câmera trocando de estado, etc.) não tem rosto nenhum pra
    // achar — e passar isso pro face-api trava a detecção indefinidamente
    // em vez de simplesmente não achar nada. Trata como "nenhum rosto",
    // igual a qualquer outra tentativa sem sucesso.
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      return null;
    }
    await this.ensureModelsLoaded();
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection?.descriptor ?? null;
  }

  isMatch(a: Float32Array | number[], b: Float32Array | number[]): boolean {
    const distance = faceapi.euclideanDistance(Array.from(a), Array.from(b));
    return distance < MATCH_THRESHOLD;
  }
}
