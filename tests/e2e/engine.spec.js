import { expect, test } from '@playwright/test';

test('renderer genérico consome o schema Tabs → Sections → Containers → Components', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/test-engine.html');

  await expect(page.getByRole('heading', { name: 'Personagem (Sistema Fictício)' })).toBeVisible();
  await expect(page.getByLabel('Nome')).toHaveValue('Protótipo');
  await expect(page.getByLabel('Atributo A')).toHaveValue('12');
  await expect(page.locator('#formula-output')).toContainText('abilityModifier(Atributo A = 12) = 3');

  await page.getByLabel('Atributo A').fill('20');
  await expect(page.locator('#formula-output')).toContainText('abilityModifier(Atributo A = 20) = 5');
  expect(errors).toEqual([]);
});
