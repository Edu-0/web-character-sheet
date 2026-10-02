import { expect, test } from '@playwright/test';

const errorsByPage = new WeakMap();
const results = (page) => page.locator('#sheet-search-list button');
const result = (page, name) => results(page).filter({ has: page.locator('.sheet-search__name', { hasText: new RegExp(`^${name}$`) }) });

test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});
test.afterEach(async ({ page }) => { expect(errorsByPage.get(page)).toEqual([]); });

async function openRpg(page) {
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
}

for (const presentation of ['Ficha estática', 'Ficha modular', 'Comparar lado a lado']) {
  test(`busca D&D mostra o bônus atual e navega em ${presentation}`, async ({ page }) => {
    await page.getByRole('button', { name: presentation, exact: true }).click();
    const score = presentation === 'Ficha estática' ? page.locator('[data-ability="dex"] .ability-card__score') : page.getByRole('spinbutton', { name: 'Valor de Destreza', exact: true });
    await score.fill('16');
    const input = page.locator('#sheet-search-input');
    await input.fill('acrobcaia');
    await expect(result(page, 'Acrobacia')).toHaveCount(1);
    await expect(result(page, 'Acrobacia').locator('.sheet-search__value')).toHaveText('+3');
    await page.getByRole('tab', { name: 'Combate', exact: true }).first().click();
    await input.press('Enter');
    await expect(page.locator('.search-target')).toBeVisible();
    if (presentation !== 'Ficha modular') await expect(page.locator('#panel-identity')).toBeVisible();
    if (presentation !== 'Ficha estática') await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])')).toHaveAttribute('id', /identity$/);
    await expect(page.locator('#dice-history li')).toHaveCount(0);
    if (presentation === 'Ficha estática') await page.locator('[data-skill="acrobatics"] [data-el="proficient"]').check();
    else await page.getByLabel('Proficiência em Acrobacia', { exact: true }).check();
    await input.focus();
    await expect(result(page, 'Acrobacia').locator('.sheet-search__value')).toHaveText('+5');
  });
}

test('perícia implícita é encontrada sem cadastrar dados e pode ser revelada', async ({ page }) => {
  await openRpg(page);
  const snapshot = await page.evaluate(async () => JSON.stringify((await import('/js/state.js')).state.get()));
  await page.locator('#sheet-search-input').fill('atletimso');
  await expect(result(page, 'Atletismo').locator('.sheet-search__value')).toHaveText('d4 · dado base');
  await result(page, 'Atletismo').click();
  await expect(page.getByRole('tab', { name: 'Perícias', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.engine-skill-catalog').getByLabel('Atletismo', { exact: true })).toHaveValue('4');
  expect(await page.evaluate(async () => JSON.stringify((await import('/js/state.js')).state.get()))).toBe(snapshot);
  await page.locator('.engine-skill-catalog').getByLabel('Atletismo', { exact: true }).selectOption('6');
  await page.locator('#sheet-search-input').focus();
  await expect(result(page, 'Atletismo').locator('.sheet-search__value')).toHaveText('d6');
});

test('busca conteúdo em cartões recolhidos, abre o campo e aceita teclado', async ({ page }) => {
  await page.getByRole('tab', { name: 'Habilidades', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Habilidade', exact: true }).click();
  const entry = page.locator('#generic-sheet-host .engine-entry').first();
  await entry.locator('summary').click();
  await entry.getByLabel('Nome', { exact: true }).fill('Passo Lunar');
  await entry.getByLabel('Descrição', { exact: true }).fill(`${'Texto de campanha. '.repeat(30)}Encontra o santuário da estrela prateada.`);
  await entry.locator('summary').click();
  await page.getByRole('tab', { name: 'Identidade', exact: true }).click();
  const input = page.locator('#sheet-search-input');
  await input.fill('santuario');
  await expect(result(page, 'Passo Lunar · Descrição')).toContainText('santuário');
  await input.press('ArrowDown');
  await expect(results(page).first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(input).toBeFocused();
  await expect(page.locator('#sheet-search-results')).toBeHidden();
  await input.fill('estrela prateada');
  await input.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(entry).toHaveAttribute('open', '');
  await expect(page.locator('.search-target')).toContainText('Descrição');
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  await page.locator('#sheet-search-clear').click();
  await expect(input).toHaveValue('');
});

test('sistema importado usa rótulos, repetições, recursos, fórmulas e itens próprios', async ({ page }) => {
  const pkg = {
    kind: 'rpg-system-package', schemaVersion: 1,
    system: { schemaVersion: 1, id: 'busca-generica', name: 'Busca Genérica', diceSet: [6], stats: [{ key: 'reflex', label: 'Reflexos' }], formulas: { double: 'stats.reflex * 2' },
      characterTemplate: { schemaVersion: 1, meta: { system: 'busca-generica' }, name: '', stats: { reflex: 7 }, energy: { current: 2, max: 9 }, items: [{ name: 'Lanterna', notes: 'Luz para o subterrâneo' }] } },
    layouts: [{ schemaVersion: 1, id: 'generic-layout', system: 'busca-generica', tabs: [
      { id: 'main', label: 'Principal', sections: [{ id: 'stats', title: 'Estatísticas', containers: [
        { id: 'repeated', repeat: { source: 'system.stats' }, components: [{ type: 'number', field: 'stats.{key}', label: '{label}' }] },
        { id: 'derived', components: [{ type: 'computed', label: 'Reflexos dobrados', formula: 'double' }, { type: 'resource', field: 'energy', label: 'Vigor' }] },
      ] }] },
      { id: 'equipment', label: 'Bagagem', sections: [{ id: 'items', title: 'Objetos', containers: [{ id: 'table', components: [{ type: 'table', field: 'items', label: 'Objetos', itemSchema: { name: { type: 'text', label: 'Nome' }, notes: { type: 'textarea', label: 'Notas' } } }] }] }] },
    ] }],
  };
  await page.locator('#input-import-system').setInputFiles({ name: 'generic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Busca Genérica' }).getByRole('button', { name: 'Abrir' }).click();
  const input = page.locator('#sheet-search-input');
  await input.fill('reflexos');
  await expect(result(page, 'Reflexos').locator('.sheet-search__value')).toHaveText('7');
  await expect(result(page, 'Reflexos dobrados').locator('.sheet-search__value')).toHaveText('14');
  await result(page, 'Reflexos').click();
  await page.getByLabel('Reflexos', { exact: true }).fill('8');
  await input.focus();
  await expect(result(page, 'Reflexos dobrados').locator('.sheet-search__value')).toHaveText('16');
  await input.fill('vigor');
  await expect(result(page, 'Vigor').locator('.sheet-search__value')).toHaveText('2 / 9');
  await input.fill('subterraneo');
  await result(page, 'Lanterna · Notas').click();
  await expect(page.getByRole('tab', { name: 'Bagagem' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.search-target textarea')).toHaveValue('Luz para o subterrâneo');
});

test('busca estática revela inventário filtrado e outras proficiências', async ({ page }) => {
  await page.getByRole('button', { name: 'Ficha estática', exact: true }).click();
  await page.getByRole('tab', { name: 'Inventário', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar Item', exact: true }).click();
  await page.locator('#inventory-tbody [data-field="name"]').fill('Lanterna');
  await page.locator('#inventory-search').fill('Espada');
  await expect(page.locator('#inventory-tbody tr')).toHaveCount(0);
  await page.locator('#sheet-search-input').fill('lanterna');
  await result(page, 'Lanterna').click();
  await expect(page.locator('#inventory-search')).toHaveValue('');
  await expect(page.locator('.search-target [data-field="name"]')).toHaveValue('Lanterna');
  await page.getByRole('tab', { name: 'Proficiências', exact: true }).click();
  await page.locator('#tags-other input').fill('Navegação estelar');
  await page.locator('#tags-other input').press('Enter');
  await page.getByRole('tab', { name: 'Identidade', exact: true }).click();
  await page.locator('#sheet-search-input').fill('navegacao estelar');
  await result(page, 'Navegação estelar').click();
  await expect(page.locator('#tags-other')).toHaveClass(/search-target/);
  await expect(page.locator('#panel-proficiencies')).toBeVisible();
});

test('troca de personagem limpa a busca e mensagens vazias não mostram dados antigos', async ({ page }) => {
  await page.locator('#sheet-search-input').fill('acrobacia');
  await openRpg(page);
  await expect(page.locator('#sheet-search-input')).toHaveValue('');
  await expect(page.locator('#sheet-search-results')).toBeHidden();
  await page.locator('#sheet-search-input').fill('zzzzzzzzzzzz');
  await expect(page.locator('#sheet-search-status')).toHaveText('Nenhum resultado. Tente outro termo.');
  await expect(results(page)).toHaveCount(0);
});

test('paleta e modo persistem separadamente e o cabeçalho preserva a paleta', async ({ page }) => {
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.locator('[data-palette-choice="forest"]').click();
  await page.locator('#appearance-mode').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
  await page.locator('#btn-theme-toggle').click();
  await expect(page.locator('#appearance-mode')).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-palette-choice="forest"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('todas as paletas têm contraste de rótulos e cabem nas duas fichas', async ({ page }, testInfo) => {
  // A matriz percorre 24 combinações e vários tamanhos, incluindo capturas.
  test.setTimeout(90_000);
  for (const system of ['dnd', 'rpg']) {
    if (system === 'rpg') { await openRpg(page); await page.getByRole('tab', { name: 'Atributos', exact: true }).click(); }
    for (const palette of ['classic', 'editorial', 'forest', 'ruby', 'monochrome', 'petals']) for (const mode of ['light', 'dark']) {
      await page.getByRole('button', { name: 'Configurações', exact: true }).click();
      await page.locator(`[data-palette-choice="${palette}"]`).click();
      await page.locator('#appearance-mode').selectOption(mode);
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
      await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
      for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
      // Validação numérica dos tokens efetivos: rótulos, textos e destaques.
      const ratios = await page.evaluate(() => {
        const root = document.querySelector('.engine-sheet');
        const style = getComputedStyle(root);
        const luminance = (hex) => {
          const rgb = hex.trim().replace('#', '').match(/../g).map((pair) => parseInt(pair, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const token = (name) => style.getPropertyValue(`--color-${name}`);
        return ['text', 'text-faint', 'text-muted', 'accent-strong'].flatMap((foreground) => ['panel', 'panel-alt', 'bg-elevated'].map((background) => ratio(token(foreground), token(background))));
      });
      expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: testInfo.outputPath(`${system}-${palette}-${mode}.png`) });
    }
  }
});
