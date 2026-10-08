import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('ficha modular padrão exporta e reimporta o mesmo personagem JSON @smoke', async ({ page }) => {
  await expect(page.locator('#generic-sheet-host')).toBeVisible();
  await expect(page.locator('#legacy-dnd-sheet')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ficha modular' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])').getByLabel('Nome do personagem').fill('Lia Exportável');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btn-export').click(),
  ]);
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.identity.name).toBe('Lia Exportável');
  expect(exported.meta.system).toBe('dnd2024');

  await page.locator('#input-import-file').setInputFiles({
    name: 'lia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.locator('#input-import-file')).toHaveValue('');
  await expect(page.locator('#shell-current-character')).toHaveText('Lia Exportável');
  await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])').getByLabel('Nome do personagem')).toHaveValue('Lia Exportável');
  await page.reload();
  await expect(page.locator('#generic-sheet-host')).toBeVisible();
  await expect(page.locator('#shell-current-character')).toHaveText('Lia Exportável');
});

test('alterna entre ficha estática e modular sem duplicar o personagem', async ({ page }) => {
  await page.getByRole('button', { name: 'Ficha estática' }).click();
  await page.locator('#legacy-dnd-sheet [data-bind="identity.name"]').fill('Mirna');
  await page.getByRole('button', { name: 'Ficha modular' }).click();
  await expect(page.locator('#legacy-dnd-sheet')).toBeHidden();
  await expect(page.locator('#generic-sheet-host')).toBeVisible();
  await expect(page.locator('#generic-sheet-host input[type="text"]').first()).toHaveValue('Mirna');

  await page.locator('#generic-sheet-host input[type="text"]').first().fill('Mirna da Névoa');
  await expect(page.locator('#shell-current-character')).toHaveText('Mirna da Névoa');
  await page.getByRole('button', { name: 'Ficha estática' }).click();
  await expect(page.locator('#legacy-dnd-sheet [data-bind="identity.name"]')).toHaveValue('Mirna da Névoa');
  await expect(page.locator('#generic-sheet-host')).toBeHidden();
  await page.reload();
  await expect(page.locator('#legacy-dnd-sheet [data-bind="identity.name"]')).toHaveValue('Mirna da Névoa');
});

test('compara a mesma aba e sincroniza atributos nos dois sentidos @smoke', async ({ page }) => {
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  await expect(page.locator('#legacy-dnd-sheet')).toBeVisible();
  await expect(page.locator('#generic-sheet-host')).toBeVisible();

  const modularScore = page.locator('.engine-dnd-ability__score').first();
  await modularScore.fill('16');
  await expect(page.locator('.ability-card__score').first()).toHaveValue('16');
  await page.locator('.ability-card__score').first().fill('18');
  await expect(page.locator('.engine-dnd-ability__score').first()).toHaveValue('18');

  await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Magias' }).click();
  await expect(page.locator('#panel-spells')).toBeVisible();
  await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Inventário' }).click();
  await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])')).toHaveAttribute('id', /inventory/);
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(page.locator('#legacy-dnd-sheet')).toBeVisible();
  await expect(page.locator('#generic-sheet-host')).toBeVisible();
  await expect(page.locator('.engine-dnd-ability__score').first()).toHaveValue('18');
  await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])')).toHaveAttribute('id', /inventory/);
});

test('modular oferece perícias, espaços de magia e rolagens funcionais', async ({ page }) => {
  await page.getByRole('button', { name: 'Ficha modular' }).click();
  await page.locator('.engine-dnd-skill [aria-label="Especialização em Acrobacia"]').check();
  await expect(page.locator('.engine-dnd-skill [aria-label="Proficiência em Acrobacia"]')).toBeChecked();
  await page.locator('.engine-dnd-skill [aria-label="Rolar Acrobacia"]').click();
  await expect(page.locator('#dice-result')).toContainText('1d20');

  await page.locator('.engine-dnd-ability__score').nth(4).fill('16');
  await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Magias' }).click();
  await page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden]) select').first().selectOption('wis');
  await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden]) .engine-dnd-derived__value').first()).toHaveText('13');
  const slot = page.locator('#generic-sheet-host .engine-slot').first();
  await slot.getByRole('spinbutton', { name: 'Máximo do nível 1' }).fill('2');
  await slot.getByRole('button', { name: 'Reduzir espaços disponíveis do nível 1' }).click();
  await expect(slot.locator('.engine-slot__count')).toHaveText('1 / 2');
});

test('habilidades podem ser reordenadas e inventário filtrado', async ({ page }) => {
  await page.getByRole('button', { name: 'Ficha modular' }).click();
  await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Habilidades' }).click();
  const features = page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden]) .engine-entry');
  await page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])').getByRole('button', { name: 'Adicionar Habilidade' }).click();
  await features.first().locator('summary').click();
  await features.first().getByRole('textbox', { name: 'Nome' }).fill('Primeira');
  await page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])').getByRole('button', { name: 'Adicionar Habilidade' }).click();
  await features.nth(1).locator('summary').click();
  await features.nth(1).getByRole('textbox', { name: 'Nome' }).fill('Segunda');
  await features.first().getByRole('button', { name: 'Mover para baixo: Primeira' }).click();
  await expect(features.first().locator('.engine-entry__title')).toHaveText('Segunda');

  await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Inventário' }).click();
  const inventory = page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])');
  await inventory.getByRole('button', { name: 'Adicionar Item' }).click();
  await inventory.locator('tbody tr').first().getByLabel('Item').fill('Corda');
  await inventory.getByRole('searchbox', { name: 'Pesquisar itens' }).fill('espada');
  await expect(inventory.locator('tbody tr')).toHaveCount(0);
  await inventory.getByRole('searchbox', { name: 'Pesquisar itens' }).fill('corda');
  await expect(inventory.locator('tbody tr')).toHaveCount(1);
});

test('retrato e impressão preservam a referência estática', async ({ page }) => {
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  const image = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>');
  await page.locator('#generic-sheet-host .engine-image input[type="file"]').setInputFiles({ name: 'retrato.svg', mimeType: 'image/svg+xml', buffer: image });
  await expect(page.locator('#generic-sheet-host .engine-image__preview')).toBeVisible();
  await expect(page.locator('#legacy-dnd-sheet #portrait-image')).toBeVisible();
  const source = await page.locator('#legacy-dnd-sheet #portrait-image').getAttribute('src');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#legacy-dnd-sheet')).toBeHidden();
  await expect(page.locator('#generic-sheet-host')).toBeHidden();
  await expect(page.locator('#print-root img')).toHaveAttribute('src', source);
  await expect(page.locator('#print-root .print-chapter')).toHaveCount(7);
  await expect(page.locator('#print-root .print-sheet')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('#legacy-dnd-sheet #portrait-image')).toBeVisible();
  await expect(page.locator('#generic-sheet-host .engine-image__preview')).toBeVisible();
});

test('valores derivados coincidem entre as duas apresentações', async ({ page }) => {
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  await page.locator('#legacy-dnd-sheet [data-bind="identity.level"]').fill('5');
  await page.locator('#generic-sheet-host .engine-dnd-ability__score').nth(4).fill('16');
  await expect(page.locator('#legacy-dnd-sheet #stat-proficiency')).toHaveText('+3');
  await expect(page.locator('#legacy-dnd-sheet #stat-passive-perception')).toHaveText('13');
  await expect(page.locator('#generic-sheet-host [data-field="combat.ac"] input')).toHaveValue('10');
  await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden]) .engine-dnd-derived__value').first()).toHaveText('+3');
  await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Magias' }).click();
  await page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden]) select').first().selectOption('wis');
  await expect(page.locator('#legacy-dnd-sheet #stat-spell-dc')).toHaveText('14');
  await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden]) .engine-dnd-derived__value').first()).toHaveText('14');
});

for (const width of [360, 768, 1280]) {
  test(`comparação não cria overflow horizontal em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Magias' }).click();
    const slotsFit = await page.locator('#generic-sheet-host .engine-slot').evaluateAll((rows) => rows.every((row) => {
      const card = row.getBoundingClientRect();
      const maximum = row.querySelector('input').getBoundingClientRect();
      return row.scrollWidth <= row.clientWidth + 1 && maximum.right <= card.right + 1;
    }));
    expect(slotsFit).toBe(true);
    if (width === 1280) {
      await page.screenshot({ path: testInfo.outputPath('dnd-compare-dark.png'), fullPage: false });
      await page.locator('#btn-theme-toggle').click();
      await page.screenshot({ path: testInfo.outputPath('dnd-compare-light.png'), fullPage: false });
    }
  });
}
