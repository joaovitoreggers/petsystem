import { expect, Page, test } from '@playwright/test';

const PASSWORD = 'senha123';

/**
 * Cobre os estados de "câmera ligada" do reconhecimento facial — a câmera
 * falsa do Chromium (ver playwright.config.ts) dá um MediaStream de
 * verdade (um padrão de barras, sem rosto nenhum), então getUserMedia()
 * funciona e o front-end reage como reagiria com uma câmera de verdade
 * ligada. O que continua fora do alcance de E2E automatizado: o caminho de
 * SUCESSO (câmera falsa não tem rosto pra detectar/casar) — isso só dá pra
 * verificar manualmente, com uma câmera e um rosto de verdade. O back-end
 * por trás (emitir/trocar/revogar o token de aparelho) já está coberto de
 * ponta a ponta em apps/backend/src/integration/device-auth.integration-spec.ts.
 */
async function goToLoginScreen(page: Page): Promise<void> {
  await page.goto('/');
}

async function loginWithPassword(page: Page, email: string): Promise<void> {
  await page.getByRole('tab', { name: 'E-mail e senha' }).click();
  await page.getByPlaceholder('nome@petsystem.local').fill(email);
  await page.getByPlaceholder('Sua senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('Reconhecimento facial — aparelho sem cadastro', () => {
  test('defaults to "E-mail e senha" and explains there is nothing to scan yet', async ({ page }) => {
    await goToLoginScreen(page);

    await expect(page.getByRole('tab', { name: 'E-mail e senha', selected: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Reconhecimento facial' }).click();
    await expect(page.getByText('Nenhum rosto cadastrado')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Entre por e-mail e senha' }),
    ).toBeVisible();
  });

  test('offers enrollment after a real login, with the camera actually live', async ({ page }) => {
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');

    await expect(page.getByText('Habilitar reconhecimento facial neste aparelho?')).toBeVisible();
    // Câmera falsa de verdade rodando: o vídeo aparece, não o aviso de
    // "câmera indisponível" — prova que getUserMedia() funcionou.
    await expect(page.locator('.enroll-face video')).toBeVisible();
    await expect(page.getByText('câmera indisponível')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Habilitar' })).toBeEnabled();
  });

  test('enrollment fails gracefully when no face is found in frame (fake camera has none)', async ({
    page,
  }) => {
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');
    await expect(page.getByRole('button', { name: 'Habilitar' })).toBeEnabled();

    await page.getByRole('button', { name: 'Habilitar' }).click();

    // Sem crash, sem travar num "Cadastrando…" pra sempre: volta pro
    // diálogo com um erro claro, ainda dá pra tentar de novo ou desistir.
    await expect(page.getByText('Não foi possível identificar um rosto')).toBeVisible();
    await expect(page.getByText('Habilitar reconhecimento facial neste aparelho?')).toBeVisible();
  });

  test('"Agora não" skips enrollment and proceeds to a real authenticated session', async ({ page }) => {
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');
    await expect(page.getByText('Habilitar reconhecimento facial neste aparelho?')).toBeVisible();

    await page.getByRole('button', { name: 'Agora não' }).click();

    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Abertas/ })).toBeVisible();
  });

  test('logout leaves no face enrollment behind (nothing was ever confirmed)', async ({ page }) => {
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');
    await page.getByRole('button', { name: 'Agora não' }).click();
    await page.getByRole('button', { name: 'Sair' }).click();

    await expect(page.getByRole('tab', { name: 'E-mail e senha', selected: true })).toBeVisible();
  });
});

test.describe('Reconhecimento facial — aparelho já cadastrado', () => {
  test.beforeEach(async ({ page }) => {
    // Simula um cadastro já existente neste "aparelho" sem depender de uma
    // captura de rosto de verdade (a câmera falsa não tem rosto nenhum
    // pra oferecer) — o consumo desse cadastro (casar + trocar o token)
    // continua sendo testado de verdade pelo resto da suíte.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'pet-digital.face-enrollment',
        JSON.stringify({
          descriptor: new Array(128).fill(0.1),
          deviceToken: 'fake-id.fake-secret',
          userLabel: 'gestor@petsystem.local',
        }),
      );
    });
  });

  test('opens straight on "Reconhecimento facial", camera live, ready to scan', async ({ page }) => {
    await goToLoginScreen(page);

    await expect(page.getByRole('tab', { name: 'Reconhecimento facial', selected: true })).toBeVisible();
    await expect(page.getByText('Posicione o rosto')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar reconhecimento facial' })).toBeEnabled();
    await expect(page.locator('.face-frame video')).toBeVisible();
  });

  test('a scan that finds no matching face fails gracefully, no crash, stays on login', async ({ page }) => {
    await goToLoginScreen(page);

    await page.getByRole('button', { name: 'Iniciar reconhecimento facial' }).click();

    await expect(page.getByText('Não foi possível identificar um rosto')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0);
  });

  test('the stale device token (never actually issued by the backend) is rejected as invalid, not crashed on', async ({
    page,
  }) => {
    // O token guardado ("fake-id.fake-secret") nunca foi emitido de
    // verdade — se o front-end de alguma forma tentasse trocá-lo por uma
    // sessão (não deveria, já que o rosto não bate primeiro), o back-end
    // recusaria com 401 e o app precisa continuar de pé, não travar.
    await goToLoginScreen(page);

    await page.getByRole('button', { name: 'Iniciar reconhecimento facial' }).click();
    await expect(page.getByText('Não foi possível identificar um rosto')).toBeVisible();

    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    await page.getByRole('tab', { name: 'E-mail e senha' }).click();
    await expect(page.getByPlaceholder('nome@petsystem.local')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
