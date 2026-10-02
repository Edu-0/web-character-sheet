import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)'); });

test('Mais fecha por Escape, fora e comando; largura e foco não duplicam ações', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const selected = page.locator('[data-dnd-presentation][aria-pressed="true"]');
  await expect(selected).toHaveCSS('min-height', '44px');
  const selection = await selected.evaluate(el => ({ color: getComputedStyle(el).color, border: getComputedStyle(el).borderTopColor, background: getComputedStyle(el).backgroundColor }));
  expect(selection.border).toBe(selection.color);
  expect(selection.background).not.toBe('rgba(0, 0, 0, 0)');
  const more = page.getByRole('button', { name: 'Mais', exact: true });
  await more.click(); await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#btn-export')).toHaveAccessibleName('Exportar JSON');
  await expect(page.locator('#btn-import')).toHaveAccessibleName('Importar JSON');
  await page.keyboard.press('Tab'); await expect(page.locator('#btn-new-character')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(more).toBeFocused();
  await expect(page.locator('#secondary-actions')).toBeHidden();
  await more.click(); await page.locator('#btn-save-character').click();
  await expect(more).toBeFocused(); await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click(); await page.locator('.shell-header__brand').click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  for (const width of [1280, 768, 900, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('#btn-export')).toHaveCount(1);
    if (width > 900) await expect(page.locator('#btn-export')).toBeVisible();
    else { await more.click(); await expect(page.locator('#btn-export')).toBeVisible(); await page.keyboard.press('Escape'); }
  }
});

test('Configurações: abas pelo teclado, famílias recolhíveis, prévia e preferências preservadas', async ({ page }) => {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('tab', { name: 'Cores', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Dados', exact: true })).toBeFocused();
  await expect(page.locator('#appearance-dice')).toBeVisible();
  await page.locator('#dice-display-mode').selectOption('illustrated');
  await page.getByRole('tab', { name: 'Dados', exact: true }).focus(); await page.keyboard.press('End');
  await expect(page.locator('#appearance-ornaments')).toBeVisible();
  await page.locator('#ornament-preset').selectOption('garden');
  const family = page.locator('[data-family="botanical"]');
  await expect(family.locator('summary')).toContainText('Ramos');
  await family.locator('summary').click(); await expect(page.getByLabel('Usar Ramos', { exact: true })).toBeVisible();
  await family.locator('summary').click(); await expect(page.getByLabel('Usar Ramos', { exact: true })).toBeHidden();
  await expect(family.locator('summary')).toBeFocused();
  const settings = await page.evaluate(() => localStorage.getItem('ficha-rpg:settings'));
  await page.getByRole('tab', { name: 'Ornamentos', exact: true }).focus(); await page.keyboard.press('Home');
  await expect(page.locator('#appearance-colors')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('ficha-rpg:settings'))).toBe(settings);
});

test('reflow em zoom equivalente a 200%, paisagem, texto longo e foco visível', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.locator('#generic-sheet-host').getByLabel('Nome do personagem').fill('Nome muito longo que continua identificável no cabeçalho da ficha e não cobre controles');
  await expect(page.locator('#sheet-heading-name')).toContainText('não cobre controles');
  await page.evaluate(async () => (await import('/js/artwork.js')).applyArtworkPreferences({ artwork: { enabled: true, selected: [{ id: 'dice-pair', position: 'left' }, { id: 'botanical-petals', position: 'center' }, { id: 'arcane-orbits', position: 'right' }] } }));
  await page.getByRole('button', { name: 'Mais', exact: true }).focus();
  expect(await page.locator('#btn-more').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#sheet-ornaments svg')).toHaveCount(3);
});
