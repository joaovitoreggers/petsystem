import { FaceRecognitionService } from './face-recognition.service';

describe('FaceRecognitionService', () => {
  let service: FaceRecognitionService;

  beforeEach(() => {
    service = new FaceRecognitionService();
  });

  describe('isMatch', () => {
    it('is true for identical descriptors', () => {
      const descriptor = new Array(128).fill(0.42);

      expect(service.isMatch(descriptor, descriptor)).toBe(true);
    });

    it('is true for descriptors close enough to be the same person', () => {
      const a = new Array(128).fill(0.5);
      const b = a.map((v) => v + 0.001);

      expect(service.isMatch(a, b)).toBe(true);
    });

    it('is false for descriptors far enough apart to be different people', () => {
      const a = new Array(128).fill(0);
      const b = new Array(128).fill(1);

      expect(service.isMatch(a, b)).toBe(false);
    });

    it('accepts both Float32Array and plain number[] interchangeably', () => {
      const descriptor = new Array(128).fill(0.3);

      expect(service.isMatch(Float32Array.from(descriptor), descriptor)).toBe(true);
    });
  });
});
