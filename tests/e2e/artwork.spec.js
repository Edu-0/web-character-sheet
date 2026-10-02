import { expect, test } from '@playwright/test';

const errors = new WeakMap();
const preferences = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ficha-rpg:settings')));
const character = (page) => page.evaluate(async () => JSON.stringify((await import('/js/state.js')).state.get()));
const settings = (page) => page.getByRole('button', { name: 'Configurações', exact: true }).click();
const sheet = (page) => page.getByRole('button', { name: 'Ficha atual', exact: true }).click();

test.beforeEach(async ({ page }) => {
  const messages = [];
  errors.set(page, messages);
  page.on('pageerror', (error) => messages.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') messages.push(message.text()); });
  page.on('request', (request) => { if (request.url().includes('/docs/references/')) messages.push('Carregou referência privada'); });
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function openRpg(page) {
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
}

test('texto é padrão; vetores mantêm nomes e rolagens e persistem independentemente da decoração', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-dice-display', 'text');
  await expect(page.locator('#sheet-ornaments')).toBeHidden();
  await page.locator('#btn-dice-toggle').click();
  const d6 = page.locator('#dice-buttons').getByRole('button', { name: 'd6', exact: true });
  await expect(d6.locator('svg')).toBeHidden();
  await d6.click();
  await expect(page.locator('#dice-history li')).toHaveCount(1);
  const snapshot = await character(page);
  await settings(page);
  await page.getByRole('tab', { name: 'Dados', exact: true }).click();
  await page.locator('#dice-display-mode').selectOption('illustrated');
  await expect(page.locator('#dice-display-preview .dice-glyph')).toHaveCount(2);
  await expect(page.locator('#dice-display-preview .dice-glyph').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Cores', exact: true }).click();
  await page.locator('[data-palette-choice="ruby"]').click();
  await page.locator('#appearance-mode').selectOption('light');
  await sheet(page);
  await expect(page.locator('#sheet-ornaments')).toBeHidden();
  await expect(d6.locator('svg')).toBeVisible();
  await d6.click();
  await expect(page.locator('#dice-history li')).toHaveCount(2);
  expect(await character(page)).toBe(snapshot);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-dice-display', 'illustrated');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ruby');
  const fallback = await page.evaluate(async () => {
    const { createDiceLabel } = await import('/js/dice-display.js');
    const label = createDiceLabel([6, 30]);
    return { text: label.textContent, icons: label.querySelectorAll('svg').length };
  });
  expect(fallback).toEqual({ text: 'd6 + d30', icons: 1 });
});

test('combinações, posição ocupada, intensidade e ativação preservam a ficha e sobrevivem à recarga', async ({ page }) => {
  const snapshot = await character(page);
  await settings(page);
  await expect(page.locator('.ornament-choice')).toHaveCount(9);
  await page.getByRole('tab', { name: 'Ornamentos', exact: true }).click();
  await page.locator('#ornament-preset').selectOption('garden');
  await page.locator('#ornament-intensity').selectOption('strong');
  await expect(page.getByLabel('Usar Ramos', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Usar Flor de pétalas', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Usar Órbitas', { exact: true })).toBeChecked();
  await page.locator('[data-family="botanical"] summary').click();
  await page.getByLabel('Posição de Ramos', { exact: true }).selectOption('center');
  await expect(page.getByLabel('Usar Flor de pétalas', { exact: true })).not.toBeChecked();
  await expect(page.locator('#ornament-notice')).toContainText('Flor de pétalas deu lugar a Ramos');
  await expect(page.locator('#ornament-preset')).toHaveValue('custom');
  await page.locator('[data-family="dice"] summary').click();
  await page.getByLabel('Usar Dupla de dados', { exact: true }).check();
  await expect(page.getByLabel('Posição de Dupla de dados', { exact: true })).toHaveValue('left');
  const selected = (await preferences(page)).artwork.selected;
  await page.locator('#ornament-enabled').uncheck();
  expect((await preferences(page)).artwork.selected).toEqual(selected);
  await page.getByRole('tab', { name: 'Dados', exact: true }).click();
  await page.locator('#dice-display-mode').selectOption('illustrated');
  await sheet(page);
  await expect(page.locator('#sheet-ornaments')).toBeHidden();
  await settings(page);
  await page.getByRole('tab', { name: 'Ornamentos', exact: true }).click();
  await page.locator('#ornament-enabled').check();
  await page.getByRole('tab', { name: 'Cores', exact: true }).click();
  await page.locator('[data-palette-choice="monochrome"]').click();
  await sheet(page);
  for (const presentation of ['Ficha estática', 'Ficha modular', 'Comparar lado a lado']) {
    await page.getByRole('button', { name: presentation, exact: true }).click();
    await expect(page.locator('#sheet-ornaments svg')).toHaveCount(3);
    await expect(page.locator('#sheet-ornaments')).toBeVisible();
  }
  expect(await character(page)).toBe(snapshot);
  await page.reload();
  await expect(page.locator('#sheet-ornaments')).toHaveAttribute('data-intensity', 'strong');
  expect((await preferences(page)).artwork.selected).toEqual(selected);
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await openRpg(page);
  await expect(page.locator('#sheet-ornaments svg')).toHaveCount(3);
  await expect(page.locator('html')).toHaveAttribute('data-dice-display', 'illustrated');
});

test('traços compostos atualizam os ícones sem multiplicar fontes ou modificar os resultados ao trocar de modo', async ({ page }) => {
  await openRpg(page);
  await settings(page);
  await page.getByRole('tab', { name: 'Dados', exact: true }).click();
  await page.locator('#dice-display-mode').selectOption('illustrated');
  await sheet(page);
  await page.getByRole('tab', { name: 'Atributos', exact: true }).click();
  const control = page.getByLabel('Força', { exact: true });
  const row = control.locator('..');
  await control.selectOption('8');
  await expect(row.locator('.dice-glyph')).toHaveCount(1);
  const path8 = await row.locator('path').getAttribute('d');
  await control.selectOption('6');
  expect(await row.locator('path').getAttribute('d')).not.toBe(path8);
  await control.selectOption('composite');
  await page.getByLabel('Composição de Força').fill('d12 + d6');
  await expect(row.locator('.dice-glyph')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Combate', exact: true }).click();
  const pool = page.locator('.engine-pool');
  await pool.getByText('Força (Atributo)', { exact: true }).click();
  await page.evaluate(() => { Math.random = () => 0.999; });
  await pool.getByRole('button', { name: 'Rolar Pool', exact: true }).click();
  await expect(pool.locator('.engine-roll')).toHaveCount(1);
  await expect(pool.locator('.engine-roll__die')).toHaveText('d12 + d6 · Ápice e Base');
  await expect(pool.locator('.engine-roll__die .dice-glyph')).toHaveCount(2);
  await expect(pool.locator('.engine-roll__die .rule-glyph')).toHaveCount(2);
  await expect(pool.locator('.engine-pool__summary')).toHaveText('Peso 18');
  await expect(pool.locator('.engine-pool__summary .rule-glyph')).toBeVisible();
  const snapshot = await character(page);
  await settings(page);
  await page.getByRole('tab', { name: 'Dados', exact: true }).click();
  await page.locator('#dice-display-mode').selectOption('text');
  await sheet(page);
  await expect(pool.locator('.engine-roll__die .dice-glyph').first()).toBeHidden();
  await expect(pool.locator('.engine-roll__die .rule-glyph').first()).toBeHidden();
  await expect(pool.locator('.engine-pool__summary')).toHaveText('Peso 18');
  expect(await character(page)).toBe(snapshot);
});

test('preferências inválidas descartam desenhos desconhecidos e posições duplicadas', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('ficha-rpg:settings', JSON.stringify({
    theme: 'light', palette: 'petals', diceDisplay: 'svg-only',
    artwork: { enabled: true, intensity: 'invalid', preset: 'unknown', selected: [
      { id: '<script>alert(1)</script>', position: 'left' },
      { id: 'dice-pair', position: 'left' }, { id: 'dice-orbit', position: 'left' },
      { id: 'dice-pair', position: 'right' }, { id: 'arcane-orbits', position: 'anywhere' },
    ] },
  })));
  await page.reload();
  await expect(page.locator('#sheet-ornaments svg')).toHaveCount(1);
  await expect(page.locator('#sheet-ornaments')).toHaveAttribute('data-intensity', 'soft');
  await expect(page.locator('html')).toHaveAttribute('data-dice-display', 'text');
  expect((await preferences(page)).artwork).toEqual({ enabled: true, intensity: 'soft', preset: 'custom', selected: [{ id: 'dice-pair', position: 'left' }] });
});

test('ornamentos e dados ilustrados cabem em todas as paletas e a impressão adapta a decoração', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await openRpg(page);
  await settings(page);
  await page.getByRole('tab', { name: 'Ornamentos', exact: true }).click();
  await page.locator('#ornament-preset').selectOption('garden');
  await page.getByRole('tab', { name: 'Dados', exact: true }).click();
  await page.locator('#dice-display-mode').selectOption('illustrated');
  for (const palette of ['classic', 'editorial', 'forest', 'ruby', 'monochrome', 'petals']) for (const mode of ['light', 'dark']) {
    await settings(page);
    await page.getByRole('tab', { name: 'Cores', exact: true }).click();
    await page.locator(`[data-palette-choice="${palette}"]`).click();
    await page.locator('#appearance-mode').selectOption(mode);
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await sheet(page);
    await page.getByRole('tab', { name: 'Atributos', exact: true }).click();
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const geometry = await page.evaluate(() => {
        const strip = document.querySelector('#sheet-ornaments');
        const name = document.querySelector('.sheet-heading__text').getBoundingClientRect();
        return { overlaps: [...strip.querySelectorAll('svg')].some(svg => { const r = svg.getBoundingClientRect(); return r.left < name.right && r.right > name.left && r.top < name.bottom && r.bottom > name.top; }), pointer: getComputedStyle(strip).pointerEvents };
      });
      expect(geometry.overlaps).toBe(false);
      expect(geometry.pointer).toBe('none');
    }
  }
  await page.setViewportSize({ width: 360, height: 950 });
  await page.screenshot({ path: testInfo.outputPath('petals-garden-mobile.png'), fullPage: true });
  await settings(page);
  await page.getByRole('tab', { name: 'Ornamentos', exact: true }).click();
  await page.locator('#ornament-title').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('ornaments-settings-mobile.png'), fullPage: true });
  await sheet(page);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#sheet-ornaments')).toBeHidden();
  const glyph = page.locator('#print-root .dice-glyph').first();
  await expect(glyph).toBeVisible();
  await expect(glyph).toHaveCSS('color', await page.locator('#print-root .print-heading__system').evaluate(el => getComputedStyle(el).color));
  await expect(page.locator('#print-root .print-heading__art svg')).toHaveCount(3);
});
