import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const settingLabel = 'Mostrar controles de ajuste de cálculos';
async function settings(page) {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  return page.getByRole('checkbox', { name: settingLabel });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('controles começam ocultos e a preferência é global e persistente', async ({ page }) => {
  const control = page.locator('#generic-sheet-host .engine-calculation-control').first();
  await expect(control).toBeHidden();
  const checkbox = await settings(page);
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(control).toBeVisible();
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  await expect(page.locator('#legacy-dnd-sheet .engine-calculation-control').first()).toBeVisible();
  await page.reload();
  await expect(control).toBeVisible();
  await (await settings(page)).uncheck();
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(control).toBeHidden();
  await expect(page.locator('#legacy-dnd-sheet .engine-calculation-control').first()).toBeHidden();
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await page.getByRole('tab', { name: 'Inventário', exact: true }).click();
  await expect(page.locator('.engine-inventory-summary .engine-calculation-control').first()).toBeHidden();
  await (await settings(page)).check();
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(page.locator('.engine-inventory-summary .engine-calculation-control').first()).toBeVisible();
});

test('ocultar mantém valores ajustados, rolagens e backup; restaurar reaplica a preferência', async ({ page }) => {
  await (await settings(page)).check();
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  const ability = page.locator('#generic-sheet-host .engine-dnd-ability').first();
  const control = ability.locator('.engine-calculation-control').first();
  await control.locator('summary').click();
  await control.getByRole('combobox').selectOption('fixed');
  await control.getByRole('spinbutton').fill('7');
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('+7');
  const checkbox = await settings(page);
  const downloading = page.waitForEvent('download');
  await page.locator('#btn-export-library').click();
  const backup = JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
  expect(backup.preferences.showCalculationControls).toBe(true);
  expect(backup.characters[0].calculationOverrides['dnd.ability.str']).toEqual({ mode: 'fixed', value: 7 });
  await checkbox.uncheck();
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(control).toBeHidden();
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('+7');
  await ability.getByRole('button', { name: 'Rolar teste de Força' }).click();
  await expect(page.locator('#dice-result')).toContainText('+7');
  await page.reload();
  await expect(control).toBeHidden();
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('+7');
  await settings(page);
  await page.locator('#input-import-library').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.locator('.modal select').selectOption('replace');
  await page.locator('.modal').getByRole('button', { name: 'Restaurar', exact: true }).click();
  await page.locator('.modal').getByRole('button', { name: 'Substituir dados', exact: true }).click();
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(control).toBeVisible();
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('+7');
});

for (const theme of ['light', 'dark']) test(`preferência é acessível e cabe em celular/desktop em ${theme}`, async ({ page }, testInfo) => {
  await page.evaluate(async theme => (await import('/js/theme.js')).applyTheme(theme), theme);
  const checkbox = await settings(page);
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.locator('.sheet-editing-settings').screenshot({ path: testInfo.outputPath(`calculation-settings-${theme}-${width}.png`) });
  }
});
