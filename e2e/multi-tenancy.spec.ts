import { expect, Page, test } from '@playwright/test';

const PASSWORD = 'senha123';

/**
 * E2E contra a stack real: front-end Angular servido pelo nginx do
 * docker compose, batendo no back-end/Postgres reais (ver playwright.config.ts
 * e e2e.sh). Login por e-mail/senha usa as contas semeadas por
 * `npm run backend:seed` — se o banco não tiver sido semeado, estes testes
 * falham no login.
 */
async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'E-mail e senha' }).click();
  await page.getByPlaceholder('nome@petsystem.local').fill(email);
  await page.getByPlaceholder('Sua senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
}

// Sidebar (desktop) e navegação inferior (mobile) renderizam os mesmos
// itens simultaneamente no DOM — `.first()` sempre pega a versão visível
// no viewport desktop usado por este projeto do Playwright.
function navButton(page: Page, label: string) {
  return page.getByRole('button', { name: label }).first();
}

test.describe('Navegação por papel', () => {
  test('gestor sees Usuários but not Empresas', async ({ page }) => {
    await loginAs(page, 'gestor@petsystem.local');

    await expect(navButton(page, 'Usuários')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empresas' })).toHaveCount(0);
  });

  test('platform-admin sees both Usuários and Empresas', async ({ page }) => {
    await loginAs(page, 'platform-admin@petsystem.local');

    await expect(navButton(page, 'Usuários')).toBeVisible();
    await expect(navButton(page, 'Empresas')).toBeVisible();
  });

  test('a plain técnico session sees neither Usuários nor Empresas', async ({ page }) => {
    await loginAs(page, 'porteiro@petsystem.local');

    await expect(page.getByRole('button', { name: 'Usuários' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Empresas' })).toHaveCount(0);
  });
});

test.describe('Empresas — grupos e filiais (platform-admin)', () => {
  test('creates a company group and a branch inside it', async ({ page }) => {
    const suffix = Date.now();
    const groupName = `E2E Group ${suffix}`;
    const branchName = `E2E Branch ${suffix}`;

    await loginAs(page, 'platform-admin@petsystem.local');
    await navButton(page, 'Empresas').click();

    await page.getByPlaceholder('Nome do novo grupo').fill(groupName);
    await page.getByRole('button', { name: 'Criar grupo' }).click();
    await expect(page.getByRole('button', { name: groupName })).toBeVisible();

    // A criação já seleciona o novo grupo — cria a filial nele direto.
    await page.getByPlaceholder('Nome da nova filial').fill(branchName);
    await page.getByRole('button', { name: 'Criar filial' }).click();
    await expect(page.getByText(branchName, { exact: true })).toBeVisible();
  });
});

test.describe('Usuários — tenant no cadastro (platform-admin)', () => {
  test('creates a user scoped to a group/branch, then clears the branch on edit', async ({ page }) => {
    const suffix = Date.now();
    const userEmail = `e2e-user-${suffix}@petsystem.local`;

    await loginAs(page, 'platform-admin@petsystem.local');
    await navButton(page, 'Usuários').click();
    await page.getByRole('button', { name: 'Cadastrar usuário' }).click();

    const dialog = page.locator('.dialog');
    await dialog.getByPlaceholder('ex. Bárbara M. Garlini').fill('E2E Test User');
    await dialog.getByPlaceholder('nome@petsystem.local').fill(userEmail);
    await dialog.getByPlaceholder('mínimo 6 caracteres').fill('senha123');
    // Selects na ordem em que aparecem no formulário: Papel, Grupo, Filial.
    await dialog.locator('select').nth(1).selectOption({ label: 'Lar Cooperativa Agroindustrial' });
    await dialog.locator('select').nth(2).selectOption({ label: 'Matelândia' });
    await dialog.getByRole('button', { name: 'Cadastrar usuário' }).click();

    const row = page.locator('tr', { hasText: userEmail });
    await expect(row).toContainText('Matelândia');

    // Regressão do bug real encontrado nesta feature: limpar a filial
    // (branchId null explícito) precisa mesmo desfazer a restrição, não
    // ser silenciosamente ignorado como um PATCH que omite o campo seria.
    await row.getByTitle('Editar usuário').click();
    await dialog.locator('select').nth(2).selectOption({ label: 'Todas as filiais do grupo' });
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(row).toContainText('Todas as filiais');

    // Limpeza: remove o usuário de teste criado por este run.
    await row.getByTitle('Excluir usuário').click();
    await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(row).toHaveCount(0);
  });
});

test.describe('Sessão não autenticada (reconhecimento facial simulado)', () => {
  test('the field screen still renders PETs via the local mock fallback, no crash', async ({ page }) => {
    await page.goto('/');

    // Sem login, a tela de Campo (home por padrão) precisa continuar de pé
    // com os dados mockados locais — é o fallback que absorve o 401 das
    // rotas agora protegidas por JwtAuthGuard.
    await expect(page.getByRole('tab', { name: 'Reconhecimento facial' })).toBeVisible();
    await expect(navButton(page, 'Campo')).toBeVisible();
  });
});
