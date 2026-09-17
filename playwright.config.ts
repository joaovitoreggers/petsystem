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
        // Sem flags especiais de câmera: a biometria nativa (ver
        // e2e/biometria-nativa.spec.ts) usa o autenticador virtual do
        // WebAuthn via CDP, que funciona de fábrica em Chromium headless —
        // sem precisar de hardware nem de --use-fake-*.
      },
    },
  ],
});
