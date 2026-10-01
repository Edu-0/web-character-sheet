import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('alterna entre ficha estática e modular sem duplicar o personagem', async ({ page }) => {
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

test('compara a mesma aba e sincroniza atributos nos dois sentidos', async ({ page }) => {
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
  await slot.getByRole('button', { name: 'Aumentar usos do nível 1' }).click();
  await expect(slot.locator('.engine-slot__count')).toHaveText('1 / 2');
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
