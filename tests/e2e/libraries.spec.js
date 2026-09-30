import { expect, test } from '@playwright/test';

const errorsByPage = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)', { timeout: 15_000 });
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});

test('troca repetidamente entre D&D e sistema-rpg sem recarregar', async ({ page }, testInfo) => {
  await page.locator('[data-bind="identity.name"]').fill('Guardião entre Sistemas');
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await expect(page.locator('#systems-list .library-card')).toHaveCount(2);

  const rpgCard = page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' });
  await rpgCard.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
  await expect(page.locator('#generic-sheet-host')).toBeVisible();
  await expect(page.locator('#legacy-dnd-sheet')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('sistema-rpg-host.png'), fullPage: false });

  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  const dndCard = page.locator('#systems-list .library-card').filter({ hasText: 'D&D 5e (2024)' });
  await dndCard.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await expect(page.locator('#legacy-dnd-sheet')).toBeVisible();
  await expect(page.locator('[data-bind="identity.name"]')).toHaveValue('Guardião entre Sistemas');

  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await rpgCard.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
});

test('restaura sistema e personagem atuais após recarregar', async ({ page }) => {
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
  const characterId = await page.evaluate(() => JSON.parse(localStorage.getItem('ficha-rpg:v2:app-session')).currentCharacterId);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.locator('#view-settings')).toBeVisible();

  await page.reload();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
  await expect(page.locator('#view-settings')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ficha-rpg:v2:app-session')).currentCharacterId)).toBe(characterId);
});

test('cria, duplica e exclui personagens na biblioteca', async ({ page }) => {
  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await expect(page.locator('#characters-list .library-card')).toHaveCount(1);

  await page.locator('#btn-library-new-character').click();
  await expect(page.locator('#view-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await expect(page.locator('#characters-list .library-card')).toHaveCount(2);

  await page.locator('#characters-list .library-card--current').getByRole('button', { name: 'Duplicar' }).click();
  await expect(page.locator('#view-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await expect(page.locator('#characters-list .library-card')).toHaveCount(3);

  await page.locator('#characters-list .library-card--current').getByRole('button', { name: 'Excluir' }).click();
  await page.locator('.modal').getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('#characters-list .library-card')).toHaveCount(2);
  await expect(page.locator('#shell-current-character')).toHaveText('Sem personagem');
});

test('mantém personagem órfão visível com aviso, sem quebrar', async ({ page }) => {
  const orphan = {
    meta: { id: 'external-id', system: 'sistema-inexistente' },
    name: 'Viajante Órfão',
  };
  await page.locator('#input-import-file').setInputFiles({
    name: 'orphan.character.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(orphan)),
  });
  await expect(page.locator('#view-characters')).toBeVisible();
  const card = page.locator('#characters-list .library-card').filter({ hasText: 'Viajante Órfão' });
  await expect(card).toContainText('não está disponível');
  await expect(card.getByRole('button', { name: 'Abrir' })).toBeDisabled();
});

test('importa, abre e exporta um pacote único de sistema', async ({ page }) => {
  const pkg = {
    schemaVersion: 1,
    kind: 'rpg-system-package',
    system: {
      id: 'sistema-importado',
      name: 'Sistema Importado',
      characterTemplate: { meta: {}, name: '', attributes: {}, resources: {} },
      diceSet: [6],
    },
    layouts: [{ id: 'imported-default', system: 'sistema-importado', pages: [] }],
  };

  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({
    name: 'imported.system.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(pkg)),
  });
  const card = page.locator('#systems-list .library-card').filter({ hasText: 'Sistema Importado' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Importado');

  const downloadPromise = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Exportar' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('sistema-importado.system.json');

  await card.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema Importado');
  await expect(page.locator('#generic-sheet-host')).toBeVisible();
});

test('gerenciadores fazem reflow em 360px sem overflow da página', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await expect(page.locator('#systems-list .library-card')).toHaveCount(2);
  let dimensions = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(dimensions[1]).toBeLessThanOrEqual(dimensions[0]);
  await page.screenshot({ path: testInfo.outputPath('systems-360.png'), fullPage: false });

  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await expect(page.locator('#characters-list .library-card')).toHaveCount(1);
  dimensions = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(dimensions[1]).toBeLessThanOrEqual(dimensions[0]);
  await page.screenshot({ path: testInfo.outputPath('characters-360.png'), fullPage: false });
});
