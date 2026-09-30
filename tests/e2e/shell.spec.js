import { expect, test } from '@playwright/test';

const runtimeErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)', { timeout: 15_000 });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

test('navega pelo shell sem remontar ou perder a ficha legada', async ({ page }) => {
  const name = page.locator('[data-bind="identity.name"]');
  await name.fill('Lia da Aurora');
  await expect(page.locator('#shell-current-character')).toHaveText('Lia da Aurora');

  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await expect(page.locator('#view-systems')).toBeVisible();
  await expect(page.locator('#view-sheet')).toBeHidden();

  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await expect(page.locator('#view-characters')).toBeVisible();

  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(page.locator('#view-settings')).toBeVisible();

  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(name).toHaveValue('Lia da Aurora');
  await expect(page.locator('#view-sheet')).toBeVisible();
});

test('mantém abas acessíveis e persiste edição no navegador', async ({ page }) => {
  const identityTab = page.getByRole('tab', { name: 'Identidade' });
  await identityTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Combate' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-combat')).toBeVisible();

  await page.getByRole('tab', { name: 'Identidade' }).click();
  await page.locator('[data-bind="identity.name"]').fill('Persistente');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo', { timeout: 2_000 });
  await page.reload();
  await expect(page.locator('[data-bind="identity.name"]')).toHaveValue('Persistente');
  await expect(page.locator('#shell-current-character')).toHaveText('Persistente');
});

test('preserva interações centrais da ficha D&D', async ({ page }) => {
  await page.getByRole('tab', { name: 'Combate' }).click();
  await page.getByRole('button', { name: 'Adicionar Ataque' }).click();
  await expect(page.locator('#attacks-list .entry-card')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Magias' }).click();
  const firstSlot = page.locator('.spell-slot-row').first();
  await firstSlot.locator('[data-el="max"]').fill('2');
  await firstSlot.locator('[data-action="use"]').click();
  await expect(firstSlot.locator('[data-el="count"]')).toHaveText('1 / 2');

  await page.locator('#btn-dice-toggle').click();
  await page.getByRole('button', { name: 'd20', exact: true }).click();
  await expect(page.locator('#dice-result')).toContainText('1d20');
  await expect(page.locator('#dice-history li')).toHaveCount(1);
});

for (const width of [360, 768, 1280]) {
  test(`shell não causa overflow horizontal em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    await page.screenshot({ path: testInfo.outputPath(`shell-${width}.png`), fullPage: false });
  });
}

test('alternância de tema continua disponível no shell', async ({ page }) => {
  const before = await page.locator('html').getAttribute('data-theme');
  await page.locator('#btn-theme-toggle').click();
  const after = await page.locator('html').getAttribute('data-theme');
  expect(after).not.toBe(before);
});
