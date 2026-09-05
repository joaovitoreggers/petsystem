import { Injectable } from '@angular/core';
import '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Encapsula TensorFlow.js + COCO-SSD (roda inteiramente no navegador) para
 * contar quantas pessoas estão em frente à câmera, filtrando pela classe
 * `person` com um limiar de confiança configurável.
 */
@Injectable({ providedIn: 'root' })
export class PersonDetectorService {
  private model: cocoSsd.ObjectDetection | null = null;
  private loadingPromise: Promise<cocoSsd.ObjectDetection> | null = null;

  loadModel(): Promise<cocoSsd.ObjectDetection> {
    if (this.model) {
      return Promise.resolve(this.model);
    }
    if (!this.loadingPromise) {
      this.loadingPromise = cocoSsd.load().then((model) => {
        this.model = model;
        return model;
      });
    }
    return this.loadingPromise;
  }

  async countPeople(
    video: HTMLVideoElement,
    confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
  ): Promise<number> {
    const model = await this.loadModel();
    const predictions = await model.detect(video);
    return predictions.filter(
      (prediction) => prediction.class === 'person' && prediction.score >= confidenceThreshold,
    ).length;
  }
}
