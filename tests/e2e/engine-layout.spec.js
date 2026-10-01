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
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('.engine-sheet')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});

test('monta abas acessíveis e persiste campos do sistema-rpg', async ({ page }) => {
  const tabs = page.locator('.engine-tab');
  await expect(tabs).toHaveCount(13);
  await expect(page.getByRole('tab', { name: 'Identidade' })).toHaveAttribute('aria-selected', 'true');

  const name = page.locator('.engine-panel:not([hidden])').getByLabel('Nome', { exact: true });
  await name.fill('Aurora Declarativa');
  await expect(page.locator('.engine-sheet__title')).toHaveText('Aurora Declarativa');
  await expect(page.locator('#shell-current-character')).toHaveText('Aurora Declarativa');

  await page.getByRole('tab', { name: 'Atributos' }).click();
  await expect(page.locator('.engine-panel:not([hidden]) label.field').filter({ hasText: /^Força/ }).locator('select')).toBeVisible();
  await page.locator('.engine-panel:not([hidden]) label.field').filter({ hasText: /^Força/ }).locator('select').selectOption('10');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Atributos' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.engine-panel:not([hidden]) label.field').filter({ hasText: /^Força/ }).locator('select')).toHaveValue('10');
  await page.getByRole('tab', { name: 'Identidade' }).click();
  await expect(page.locator('.engine-panel:not([hidden])').getByLabel('Nome', { exact: true })).toHaveValue('Aurora Declarativa');
});

test('navega pelas abas do engine com teclado', async ({ page }) => {
  const identity = page.getByRole('tab', { name: 'Identidade' });
  await identity.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Progressão' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Progressão' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Notas' })).toBeFocused();
});

for (const width of [360, 768, 1280]) {
  test(`ficha declarativa reorganiza cards sem overflow em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('tab', { name: 'Atributos' }).click();
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);

    const section = page.locator('.engine-section').first();
    const fields = section.locator('.engine-component');
    await expect(fields).toHaveCount(6);
    const boxes = await fields.evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }));
    boxes.forEach((box) => {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width + 0.5);
    });
    await page.screenshot({ path: testInfo.outputPath(`sistema-rpg-${width}.png`), fullPage: false });
  });
}

test('design language acompanha o tema claro', async ({ page }, testInfo) => {
  await page.locator('#btn-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const sectionColors = await page.locator('.engine-section').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, border: style.borderColor };
  });
  expect(sectionColors.background).toBe('rgb(255, 255, 255)');
  expect(sectionColors.border).not.toBe(sectionColors.background);
  await page.screenshot({ path: testInfo.outputPath('sistema-rpg-light.png'), fullPage: false });
});
