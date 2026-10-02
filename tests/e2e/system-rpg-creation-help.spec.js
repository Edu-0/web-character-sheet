import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('.engine-sheet')).toBeVisible();
});

test('Buffs e Debuffs somam valores do livro, persistem e ficam congelados ao concluir', async ({ page }) => {
  await page.getByRole('tab', { name: 'Progressão' }).click();
  const buffs = page.locator('[data-field="buffs"]');
  const debuffs = page.locator('[data-field="debuffs"]');
  const budget = page.locator('.engine-budget');
  await buffs.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await buffs.getByLabel('Nome', { exact: true }).fill('Benefício');
  for (const points of [1, 2, 4, 8]) {
    await buffs.getByLabel('Pontos', { exact: true }).selectOption(String(points));
    await expect(budget.getByLabel('Pontos de criação', { exact: true })).toHaveText(String(7 + points));
    await expect(budget.getByLabel('Total de Buffs', { exact: true })).toHaveText(String(points));
  }
  await debuffs.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await debuffs.getByLabel('Nome', { exact: true }).fill('Restrição');
  for (const points of [1, 2, 4, 8]) {
    await debuffs.getByLabel('Pontos', { exact: true }).selectOption(String(points));
    await expect(budget.getByLabel('Pontos de criação', { exact: true })).toHaveText(String(15 - points));
    await expect(budget.getByLabel('Total de Debuffs', { exact: true })).toHaveText(String(-points));
  }
  await debuffs.getByLabel('Pontos', { exact: true }).selectOption('2');
  await page.getByLabel('Ajuste de pontos de criação', { exact: true }).fill('3');
  await expect(budget.getByLabel('Pontos de criação', { exact: true })).toHaveText('16');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(buffs.getByLabel('Pontos', { exact: true })).toHaveValue('8');
  await expect(budget.getByLabel('Pontos de criação', { exact: true })).toHaveText('16');
  await budget.getByRole('button', { name: 'Concluir criação' }).click();
  await expect(buffs.getByLabel('Pontos', { exact: true })).toBeDisabled();
  await expect(buffs.getByRole('button', { name: 'Ajuda: Pontos', exact: true })).toBeEnabled();
  await budget.getByRole('button', { name: 'Reabrir criação' }).click();
  await buffs.getByRole('button', { name: 'Remover', exact: true }).click();
  await expect(budget.getByLabel('Pontos de criação', { exact: true })).toHaveText('8');
});

test('todos os passos das Especializações entram no custo cumulativo, inclusive múltiplas entradas', async ({ page }) => {
  await page.getByRole('tab', { name: 'Especializações' }).click();
  const list = page.locator('[data-field="specializations"]');
  await list.getByRole('button', { name: 'Adicionar', exact: true }).click();
  const entry = list.locator('.engine-entry').first();
  await entry.getByLabel('Nome', { exact: true }).fill('Arcanismo');
  for (const [die, cost] of [[4, 1], [6, 3], [8, 7], [10, 15], [12, 31]]) {
    await entry.getByLabel('Dado', { exact: true }).selectOption(String(die));
    await expect(entry.getByLabel('Custo de criação', { exact: true })).toHaveText(`${cost} pontos de criação`);
    await expect(list.getByLabel('Custo de criação de Especializações')).toContainText(`${cost} pontos`);
    await page.getByRole('tab', { name: 'Progressão' }).click();
    await expect(page.getByLabel('Gastos na criação', { exact: true })).toHaveText(String(cost));
    await page.getByRole('tab', { name: 'Especializações' }).click();
  }
  await list.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await list.locator('.engine-entry').last().getByLabel('Dado', { exact: true }).selectOption('6');
  await expect(list.getByLabel('Custo de criação de Especializações')).toContainText('34 pontos');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(list.getByLabel('Custo de criação de Especializações')).toContainText('34 pontos');
  await list.locator('.engine-entry').first().getByRole('button', { name: 'Remover', exact: true }).click();
  await page.getByRole('tab', { name: 'Progressão' }).click();
  await expect(page.getByLabel('Gastos na criação', { exact: true })).toHaveText('3');
});

test('ajuda dos campos de Técnicas abre por mouse, teclado e toque sem editar valores', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('tab', { name: 'Técnicas', exact: true }).click();
  const list = page.locator('[data-field="techniques"]');
  await list.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(list.getByRole('button', { name: /^Ajuda:/ })).toHaveCount(19);
  const button = list.getByRole('button', { name: 'Ajuda: Pontos pagos na criação', exact: true });
  const tooltip = page.locator(`#${await button.getAttribute('aria-controls')}`);
  const input = list.getByLabel('Pontos pagos na criação', { exact: true });
  const documentBox = () => input.evaluate((element) => { const box = element.getBoundingClientRect(); return { x: box.x + window.scrollX, y: box.y + window.scrollY, width: box.width, height: box.height }; });
  const before = await documentBox();
  await expect(tooltip).toBeHidden();
  await button.hover();
  await expect(tooltip).toContainText('Técnicas gratuitas do repertório usam 0');
  expect(await documentBox()).toEqual(before);
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await button.focus();
  await button.press('Escape');
  await expect(tooltip).toBeHidden();
  await list.getByLabel('Pontos pagos na criação', { exact: true }).focus();
  await button.focus();
  await expect(tooltip).toBeVisible();
  await button.press('Escape');
  await page.setViewportSize({ width: 360, height: 950 });
  await button.click();
  await expect(tooltip).toBeVisible();
  await expect(list.getByLabel('Pontos pagos na criação', { exact: true })).toHaveValue('0');
  const box = await tooltip.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(950);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  // A ajuda pertence à viewport/top layer. Uma captura da página inteira pode
  // reposicionar/fechar o popover ao redimensionar temporariamente a superfície.
  await page.screenshot({ path: testInfo.outputPath('help-mobile.png'), fullPage: false });
  await button.click();
  await expect(tooltip).toBeHidden();
  expect(errors).toEqual([]);
});
