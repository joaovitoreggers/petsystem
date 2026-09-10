// Dublê de @vladmandic/face-api para os testes: a lib real precisa de
// WebGL/backend do TensorFlow.js só disponível num navegador de verdade
// (o pacote nem resolve corretamente sob Jest/jsdom — tenta carregar o
// build de Node, que exige @tensorflow/tfjs-node, que este projeto nem
// instala, já que o alvo real é o navegador). Reconhecimento facial de
// verdade não é algo pra unit test simular; o que dá pra testar é a lógica
// em volta (ver face-recognition.service.spec.ts/pet-state.service.spec.ts),
// controlando o que este dublê "detecta" via __setMockDescriptor.
let mockDescriptor: number[] | null = new Array(128).fill(0.1);

export function __setMockDescriptor(value: number[] | null): void {
  mockDescriptor = value;
}

// Funções simples (sem `jest.fn()`) de propósito: este arquivo mora em
// `src/` e o build de produção do Angular inclui todo `src/**/*.ts` — um
// `jest.fn()` aqui quebraria esse build, já que o global `jest` só existe
// rodando sob o Jest. `moduleNameMapper` garante que só os testes o veem.
const loadFromUri = async (): Promise<void> => undefined;
export const nets = {
  tinyFaceDetector: { loadFromUri },
  faceLandmark68Net: { loadFromUri },
  faceRecognitionNet: { loadFromUri },
};

export class TinyFaceDetectorOptions {}

export function detectSingleFace() {
  return {
    withFaceLandmarks: () => ({
      withFaceDescriptor: async () =>
        mockDescriptor ? { descriptor: Float32Array.from(mockDescriptor) } : undefined,
    }),
  };
}

export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}
