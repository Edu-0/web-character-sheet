import { expect, test } from '@playwright/test';

test('renderer genérico consome o schema Tabs → Sections → Containers → Components', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/test-engine.html');

  await expect(page.getByRole('heading', { name: 'Protótipo' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Personagem (Sistema Fictício)' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Nome')).toHaveValue('Protótipo');
  await expect(page.getByLabel('Atributo A')).toHaveValue('12');
  await expect(page.locator('#formula-output')).toContainText('abilityModifier(Atributo A = 12) = 3');

  await page.getByLabel('Atributo A').fill('20');
  await expect(page.locator('#formula-output')).toContainText('abilityModifier(Atributo A = 20) = 5');
  expect(errors).toEqual([]);
});

test('página de prova da Pool continua carregando e resolvendo uma ação', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/test-dice-pool.html');
  await expect(page.locator('#character-summary')).toContainText('Kaelen');
  await page.locator('#trait-checklist input').first().check();
  await page.locator('#btn-roll-pool').click();
  await expect(page.locator('#pool-result')).toContainText('Peso');
  await page.locator('#opponent-weight-manual').fill('8');
  await page.locator('#btn-resolve').click();
  await expect(page.locator('#resolution-result')).toContainText('Resultado');
  expect(errors).toEqual([]);
});
