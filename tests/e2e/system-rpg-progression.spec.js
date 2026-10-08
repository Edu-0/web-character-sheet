import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('.engine-sheet')).toBeVisible();
});

test('criação e evoluções pagas ou narrativas mantêm saldos independentes', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('tab', { name: 'Perícias' }).click();
  await page.getByRole('button', { name: 'Editar perícias' }).click();
  await page.getByLabel('Atletismo', { exact: true }).selectOption('6');
  await page.getByRole('button', { name: 'Concluir edição' }).click();

  await page.getByRole('tab', { name: 'Especializações' }).click();
  const specializations = page.locator('.engine-panel:not([hidden])');
  await specializations.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await specializations.getByLabel('Nome', { exact: true }).fill('Arcanismo');
  await expect(specializations.getByLabel('Dado', { exact: true })).toHaveValue('4');

  await page.getByRole('tab', { name: 'Técnicas', exact: true }).click();
  const techniques = page.locator('.engine-panel:not([hidden])');
  await techniques.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await techniques.getByLabel('Nome', { exact: true }).fill('Flecha');
  await techniques.getByLabel('Pontos pagos na criação', { exact: true }).fill('2');

  await page.getByRole('tab', { name: 'Progressão' }).click();
  const budget = page.locator('.engine-budget');
  await expect(budget.getByLabel('Gastos na criação', { exact: true })).toHaveText('4');
  await expect(budget.getByLabel('Saldo de criação', { exact: true })).toHaveText('3');
  await page.getByLabel('Pontos de evolução recebidos').fill('5');
  await budget.getByRole('button', { name: 'Concluir criação' }).click();
  await expect(page.getByLabel('Qualidade', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Ajuste de pontos de criação')).toBeDisabled();
  await budget.getByLabel('Traço a evoluir').selectOption({ label: 'Atletismo · d6' });
  await budget.getByLabel('Novo dado').selectOption('8');
  await budget.getByLabel('Origem da evolução').selectOption('points');
  await expect(budget.getByLabel('Custo em pontos')).toHaveValue('2');
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('2');

  await budget.getByLabel('Traço a evoluir').selectOption({ label: 'Flecha · d4' });
  await budget.getByLabel('Origem da evolução').selectOption('narrative');
  await budget.getByLabel('Novo dado').selectOption('6');
  await expect(budget.getByLabel('Custo em pontos')).toBeDisabled();
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  await expect(budget.getByLabel('Gastos na criação', { exact: true })).toHaveText('4');
  await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('2');

  await budget.getByLabel('Origem da evolução').selectOption('points');
  await budget.getByLabel('Novo dado').selectOption('8');
  await expect(budget.getByLabel('Custo em pontos')).toHaveValue('');
  await budget.getByLabel('Custo em pontos').fill('4');
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  await expect(budget.getByRole('status', { name: 'Avisos de progressão' })).toContainText('insuficientes');
  await budget.getByLabel('Custo em pontos').fill('3');
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  await expect(budget.getByLabel('Saldo de evolução', { exact: true })).toHaveText('0');

  await page.getByRole('tab', { name: 'Técnicas', exact: true }).click();
  await expect(techniques.getByLabel('Dado máximo', { exact: true })).toHaveValue('8');
  await page.getByRole('tab', { name: 'Perícias' }).click();
  await expect(page.getByLabel('Atletismo', { exact: true })).toHaveValue('8');
  await page.getByRole('tab', { name: 'Progressão' }).click();
  await budget.getByRole('button', { name: 'Desfazer última evolução' }).click();
  await expect(budget.getByLabel('Saldo de evolução', { exact: true })).toHaveText('3');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(budget.getByLabel('Gastos na criação', { exact: true })).toHaveText('4');
  await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('2');
  await expect(budget.locator('.engine-budget__event')).toHaveCount(2);
  await expect(budget.getByRole('button', { name: 'Reabrir criação' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Técnicas', exact: true }).click();
  await expect(page.getByLabel('Dado máximo', { exact: true })).toHaveValue('6');
  await page.getByRole('tab', { name: 'Progressão' }).click();
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`progression-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('criação recalcula custos cumulativos, teto e saldo sem concluir escolhas inválidas', async ({ page }) => {
  await page.getByRole('tab', { name: 'Perícias' }).click();
  await page.getByRole('button', { name: 'Editar perícias' }).click();
  await page.getByLabel('Atletismo', { exact: true }).selectOption('8');
  await page.getByRole('tab', { name: 'Progressão' }).click();
  const budget = page.locator('.engine-budget');
  await expect(budget.getByLabel('Gastos na criação', { exact: true })).toHaveText('3');
  await expect(budget.getByRole('status', { name: 'Avisos de progressão' })).toContainText('teto inicial d6');
  await expect(budget.getByRole('button', { name: 'Concluir criação' })).toBeDisabled();
  await page.getByLabel('Qualidade', { exact: true }).selectOption('quality-21');
  await expect(budget.getByRole('button', { name: 'Concluir criação' })).toBeEnabled();
  await expect(budget.getByLabel('Saldo de criação', { exact: true })).toHaveText('18');
  await page.getByLabel('Ajuste de pontos de criação').fill('-20');
  await expect(budget.getByLabel('Saldo de criação', { exact: true })).toHaveText('-2');
  await expect(budget.getByRole('button', { name: 'Concluir criação' })).toBeDisabled();
  await page.getByLabel('Ajuste de pontos de criação').fill('2');
  await expect(budget.getByLabel('Saldo de criação', { exact: true })).toHaveText('20');
  await budget.getByRole('button', { name: 'Concluir criação' }).click();
  await budget.getByRole('button', { name: 'Reabrir criação' }).click();
  await expect(budget.getByRole('button', { name: 'Concluir criação' })).toBeVisible();
});
