import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra a stack real (front-end + back-end + Postgres), não contra
 * mocks — por padrão aponta para o docker compose local (`./run.sh`, ver
 * e2e.sh). Troque via E2E_BASE_URL para rodar contra `nx serve frontend`
 * (`http://localhost:4200`) ou outro ambiente.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:58080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera'],
        // Câmera falsa do Chromium (um padrão de barras coloridas em
        // movimento, sem rosto nenhum) — deixa getUserMedia() funcionar de
        // verdade em CI/sandbox sem hardware de câmera, então dá pra
        // testar os estados de "câmera ligada" (ver e2e/reconhecimento-
        // facial.spec.ts). Não tem rosto pra detectar, então o caminho de
        // "reconhecimento com sucesso" continua fora do alcance de E2E —
        // só dá pra verificar via captura manual de um usuário de verdade.
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
  ],
});
