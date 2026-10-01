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
  await page.getByRole('button', { name: 'Ficha estática' }).click();
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
    schemaVersion: 1,
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
      schemaVersion: 1,
      id: 'sistema-importado',
      name: 'Sistema Importado',
      characterTemplate: {
        schemaVersion: 1,
        meta: { system: 'sistema-importado' },
        name: '',
        attributes: {},
        resources: {},
      },
      diceSet: [6],
    },
    layouts: [{
      schemaVersion: 1,
      id: 'imported-default',
      system: 'sistema-importado',
      tabs: [{
        id: 'main',
        label: 'Principal',
        sections: [{
          id: 'main',
          containers: [{
            id: 'main-fields',
            layout: { type: 'grid', min: '160px', gap: 12 },
            components: [{ type: 'text', field: 'name', label: 'Nome' }],
          }],
        }],
      }],
    }],
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

test('rejeita pacote com componente desconhecido e informa o caminho exato', async ({ page }) => {
  const pkg = {
    schemaVersion: 1,
    kind: 'rpg-system-package',
    system: {
      schemaVersion: 1,
      id: 'sistema-invalido',
      name: 'Sistema Inválido',
      characterTemplate: {
        schemaVersion: 1,
        meta: { system: 'sistema-invalido' },
        name: '',
      },
    },
    layouts: [{
      schemaVersion: 1,
      id: 'invalid-default',
      system: 'sistema-invalido',
      tabs: [{
        id: 'main',
        label: 'Principal',
        sections: [{
          id: 'main',
          containers: [{
            id: 'main-fields',
            components: [{ type: 'lisst', field: 'items' }],
          }],
        }],
      }],
    }],
  };

  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({
    name: 'invalid.system.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(pkg)),
  });

  await expect(page.locator('.toast')).toContainText(
    'layout.tabs[0].sections[0].containers[0].components[0]: tipo "lisst" desconhecido',
  );
  await expect(page.locator('#systems-list .library-card').filter({ hasText: 'Sistema Inválido' })).toHaveCount(0);
});

test('rejeita personagem com versão de schema incompatível', async ({ page }) => {
  const character = {
    schemaVersion: 99,
    meta: { system: 'dnd2024' },
    identity: { name: 'Visitante do Futuro' },
  };

  await page.locator('#input-import-file').setInputFiles({
    name: 'future.character.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(character)),
  });

  await expect(page.locator('.toast')).toContainText('character.schemaVersion: deve ser 1');
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
