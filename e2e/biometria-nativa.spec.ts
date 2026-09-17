import { CDPSession, expect, Page, test } from '@playwright/test';

const PASSWORD = 'senha123';

async function goToLoginScreen(page: Page): Promise<void> {
  await page.goto('/');
}

async function loginWithPassword(page: Page, email: string): Promise<void> {
  await page.getByRole('tab', { name: 'E-mail e senha' }).click();
  await page.getByPlaceholder('nome@petsystem.local').fill(email);
  await page.getByPlaceholder('Sua senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/**
 * Autenticador de plataforma virtual do Chromium, via CDP — faz
 * navigator.credentials.create()/.get() responderem de verdade, com
 * criptografia de verdade (par de chaves real, assinatura real), sem
 * hardware nem interação manual. `automaticPresenceSimulation` +
 * `isUserVerified: true` dispensam qualquer prompt: é como se a pessoa
 * sempre confirmasse a biometria na hora. Diferente da câmera falsa que
 * este arquivo usava antes de migrar pra WebAuthn (um MediaStream sem
 * rosto nenhum, que nunca conseguia simular um reconhecimento bem-
 * sucedido), isto permite testar a cerimônia INTEIRA — cadastro e login —
 * de ponta a ponta, batendo no back-end real.
 */
async function addVirtualAuthenticator(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable', { enableUI: false });
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
}

test.describe('Biometria nativa — cadastro (depois de um login real)', () => {
  test('defaults to "E-mail e senha" on a fresh device, with the biometric tab explaining there is nothing enrolled yet', async ({
    page,
  }) => {
    // Autenticador virtual só pra este aparelho "ter" biometria de
    // plataforma disponível (platformAuthenticatorIsAvailable() precisa
    // resolver true) — sem cadastrar nenhuma credencial ainda.
    await addVirtualAuthenticator(page);
    await goToLoginScreen(page);

    await expect(page.getByRole('tab', { name: 'E-mail e senha', selected: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Biometria do aparelho' }).click();
    await expect(page.getByText('Nenhuma biometria cadastrada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entre por e-mail e senha' })).toBeVisible();
  });

  test('offers enrollment after a real login, and a real registration ceremony grants a session', async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');

    await expect(page.getByText('Habilitar biometria do aparelho?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Habilitar' })).toBeEnabled();

    await page.getByRole('button', { name: 'Habilitar' }).click();

    // Cerimônia assinada de verdade, verificada no servidor (ver
    // AuthService.verifyRegistration no back-end) — não um fluxo simulado.
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Abertas/ })).toBeVisible();
  });

  test('"Agora não" skips enrollment and proceeds to a real authenticated session', async ({ page }) => {
    await addVirtualAuthenticator(page);
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');
    await expect(page.getByText('Habilitar biometria do aparelho?')).toBeVisible();

    await page.getByRole('button', { name: 'Agora não' }).click();

    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Abertas/ })).toBeVisible();
  });

  test('logout does NOT forget the passkey — the biometric tab stays selected next time, like in a browser', async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');
    await page.getByRole('button', { name: 'Habilitar' }).click();
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();

    await page.getByRole('button', { name: 'Sair' }).click();

    await expect(
      page.getByRole('tab', { name: 'Biometria do aparelho', selected: true }),
    ).toBeVisible();
  });
});

test.describe('Biometria nativa — login (aparelho já cadastrado)', () => {
  test('a full authentication ceremony (discoverable credential, no allowCredentials) exchanges the signed assertion for a real session', async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');
    await page.getByRole('button', { name: 'Habilitar' }).click();
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(
      page.getByRole('tab', { name: 'Biometria do aparelho', selected: true }),
    ).toBeVisible();

    // As opções de login nunca restringem allowCredentials de antemão (ver
    // AuthService.getLoginOptions) — é o próprio autenticador quem escolhe
    // a passkey certa, aqui a única cadastrada no passo acima.
    await page.getByRole('button', { name: 'Usar biometria do aparelho' }).click();

    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Abertas/ })).toBeVisible();
  });
});

test.describe('Biometria nativa — sem autenticador disponível', () => {
  test('the enroll dialog degrades gracefully instead of offering a ceremony the platform cannot satisfy', async ({
    page,
  }) => {
    // Sem autenticador virtual registrado, este "aparelho" (o Chromium da
    // máquina de teste) não tem biometria de plataforma —
    // platformAuthenticatorIsAvailable() resolve false. A UI precisa
    // perceber isso sozinha e não deixar tentar uma cerimônia que o
    // sistema não tem como atender, em vez de deixar quebrar dentro de
    // navigator.credentials.create().
    await goToLoginScreen(page);
    await loginWithPassword(page, 'gestor@petsystem.local');
    await expect(page.getByText('Habilitar biometria do aparelho?')).toBeVisible();

    await expect(
      page.getByText('Este aparelho não parece ter Face ID, Touch ID, Windows Hello'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Habilitar' })).toBeDisabled();

    // Ainda dá pra desistir e seguir pra uma sessão de verdade sem a
    // biometria — "Agora não" nunca depende do autenticador existir.
    await page.getByRole('button', { name: 'Agora não' }).click();
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  });
});
