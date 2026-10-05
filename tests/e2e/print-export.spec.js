import { expect, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { populate, longText } from '../design-fixtures.mjs';

const prepare = page => page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
const snapshot = page => page.evaluate(async () => {
  const { state } = await import('/js/state.js');
  const { getAppState } = await import('/js/app-state.js');
  const app = getAppState();
  return { character: structuredClone(state.get()), settings: localStorage.getItem('ficha-rpg:settings'), view: app.currentView, ui: structuredClone(app.ui), filters: [...document.querySelectorAll('input[type="search"]')].map(el => el.value), details: [...document.querySelectorAll('.app details')].map(el => el.open) };
});
async function importFilled(page, id) {
  if (id === 'sistema-rpg') {
    await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
    await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir', exact: true }).click();
    await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
  }
  const data = populate(await page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get())), id);
  await page.locator('#input-import-file').setInputFiles({ name: 'fiction.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('#shell-current-character')).toContainText('Lia');
  return data;
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('D&D: uma ficha completa, equivalente nos três modos e sem alterar filtros ou dados', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await importFilled(page, 'dnd2024');
  let expected;
  for (const mode of ['legacy', 'engine', 'compare']) {
    await page.locator(`[data-dnd-presentation="${mode}"]`).click();
    const surface = page.locator(mode === 'legacy' ? '#legacy-dnd-sheet' : '#generic-sheet-host');
    await surface.getByRole('tab', { name: 'Inventário', exact: true }).click();
    await surface.locator('input[type="search"]').fill('sem correspondência');
    const before = await snapshot(page);
    await prepare(page);
    const root = page.locator('#print-root');
    await expect(root.locator('.print-sheet')).toHaveCount(1);
    await expect(root.locator('button, input, textarea, select, [id], [tabindex]')).toHaveCount(0);
    const content = await root.textContent();
    expect(content).toContain(longText);
    expect(content).toContain('ÚLTIMO ITEM DO INVENTÁRIO');
    expect(content).toContain('FIM DA MAGIA.');
    expect(content).toContain('23'); expect(content).toContain('38');
    expect(content).toContain('Envenenado');
    expect(content).not.toContain('Adicionar');
    expect(await root.locator('img').getAttribute('src')).toContain('data:image/');
    if (expected) expect(content).toBe(expected); else expected = content;
    await page.pdf({ format: 'A4', preferCSSPageSize: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await snapshot(page)).toEqual(before);
    await expect(root).toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('impressão fora da ficha, repetição e edição anterior ao debounce preservam o estado', async ({ page }) => {
  await page.locator('#generic-sheet-host').getByLabel('Nome do personagem', { exact: true }).fill('Edição recém-digitada');
  // Executado imediatamente após input; o PDF não lê a cópia de localStorage.
  await prepare(page);
  expect(await page.locator('#print-root h1').textContent()).toBe('Edição recém-digitada');
  for (const name of ['Configurações', 'Personagens', 'Sistemas']) {
    await page.getByRole('button', { name, exact: true }).click();
    const before = await snapshot(page);
    await prepare(page); await prepare(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.app')).toBeHidden();
    await expect(page.locator('#print-root')).toBeVisible();
    await expect(page.locator('#print-root h1')).toHaveCount(1);
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await snapshot(page)).toEqual(before);
  }
  await page.evaluate(() => { window.print = () => { window.dispatchEvent(new Event('beforeprint')); window.dispatchEvent(new Event('afterprint')); }; });
  await page.locator('#btn-print').click();
  await page.locator('#print-options').getByRole('button', { name: 'Imprimir / salvar PDF', exact: true }).click();
  await expect(page.locator('#print-root')).toBeEmpty();
});

test('autoral: compostos, perícias implícitas e registros persistidos, sem rolar nem cobrar custos', async ({ page }) => {
  await importFilled(page, 'sistema-rpg');
  await page.evaluate(() => {
    crypto.getRandomValues = () => { throw new Error('Impressão tentou rolar'); };
  });
  const before = await snapshot(page);
  await prepare(page);
  const root = page.locator('#print-root');
  const content = await root.textContent();
  expect(content).toContain('Técnica aprendida');
  for (const text of ['d12 + d6', '7 / 16', 'Ferido na travessia', 'Aprendizado com a cartógrafa', 'Luz mantida', 'Energia paga: 2', 'Concentração:', 'Energia recuperada: 2', 'Acampamento', 'FIM DA DESCRIÇÃO INTEGRAL.', 'ÚLTIMO ITEM DO INVENTÁRIO']) expect(content).toContain(text);
  expect(content).not.toContain('Aplicar conjunto');
  expect(content).not.toContain('Técnica a utilizar');
  await expect(root.locator('button, input, select, textarea')).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
  const skill = root.locator('.print-field').filter({ has: page.locator('.print-label', { hasText: /^Furtividade$/ }) });
  await expect(skill).toContainText('d4');
  // O mesmo inventário aparece em duas abas de tela, mas é impresso uma vez.
  expect(content.split('Equipamento 42').length - 1).toBe(1);
});

test('PDF importado: d30, seleção, tabela com continuação, texto maior que uma página e fundos independentes', async ({ page }) => {
  test.setTimeout(60_000);
  const id = 'papel-teste';
  const pkg = { kind: 'rpg-system-package', schemaVersion: 1,
    system: { schemaVersion: 1, id, name: 'Caderno de viagem fictício', dieScale: [4, 6, 8, 10, 12, 20, 30], formulas: { double: 'score * 2' }, characterTemplate: {
      schemaVersion: 1, meta: { system: id }, name: 'Nara — teste de impressão', score: 7, die: 30, composite: { dice: [{ sides: 12 }, { sides: 6 }] }, choice: 'north', flag: false, blank: '',
      items: Array.from({ length: 70 }, (_, i) => ({ name: `Linha ${i + 1}`, count: i + 1, note: 'Conteúdo tabular' })), notes: longText,
      longItems: [{ name: 'Item com descrição extensa', note: longText + '\nFIM DO ITEM EXTENSO.' }],
    } },
    layouts: [{ schemaVersion: 1, id: 'paper-layout', system: id, tabs: [{ id: 'main', label: 'Viagem', sections: [{ id: 'fields', title: 'Registro', containers: [{ id: 'data', components: [
      { type: 'die', field: 'die', label: 'Dado sem arte' }, { type: 'die', field: 'composite', label: 'Fonte composta', allowComposite: true },
      { type: 'select', field: 'choice', label: 'Destino', options: [{ value: 'north', label: 'Montanhas do norte' }] },
      { type: 'boolean', field: 'flag', label: 'Preparado' }, { type: 'text', field: 'blank', label: 'Vazio', placeholder: 'NÃO IMPRIMIR PLACEHOLDER' },
      { type: 'computed', label: 'Dobro atual', formula: 'double' },
      { type: 'table', field: 'items', label: 'Bagagem', searchable: true, itemSchema: { name: { type: 'text', label: 'Nome' }, count: { type: 'number', label: 'Quantidade' }, note: { type: 'text', label: 'Observação' } } },
      { type: 'textarea', field: 'notes', label: 'Diário integral' },
      { type: 'table', field: 'longItems', label: 'Registro extenso', itemSchema: { name: { type: 'text', label: 'Nome' }, note: { type: 'textarea', label: 'Detalhes' } } },
    ] }] }] }] }],
  };
  await page.locator('#input-import-system').setInputFiles({ name: 'paper.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: pkg.system.name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText(pkg.system.name);
  await page.evaluate(async () => (await import('/js/artwork.js')).applyArtworkPreferences({ diceDisplay: 'illustrated' }));
  await page.locator('#generic-sheet-host input[type="search"]').fill('nada');
  await prepare(page);
  const root = page.locator('#print-root');
  expect(await root.textContent()).toContain('Montanhas do norte');
  expect(await root.textContent()).not.toContain('NÃO IMPRIMIR');
  await expect(root.locator('.print-field').filter({ hasText: 'Dado sem arte' }).locator('svg')).toHaveCount(0);
  await expect(root.locator('.print-field').filter({ hasText: 'Fonte composta' }).locator('svg')).toHaveCount(2);
  await expect(root.locator('tbody tr')).toHaveCount(70);
  expect(await root.textContent()).toContain('14');
  await mkdir('output/pdf', { recursive: true });
  for (const [mode, backgrounds] of [['dark', true], ['light', false]]) {
    await page.evaluate(async mode => (await import('/js/theme.js')).applyTheme(mode), mode);
    const before = await snapshot(page);
    await page.pdf({ path: `output/pdf/imported-${mode}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: backgrounds, displayHeaderFooter: false });
    expect(await snapshot(page)).toEqual(before);
  }
});

test('JSON continua um backup completo após preparar e cancelar impressão', async ({ page }) => {
  const data = await importFilled(page, 'dnd2024');
  await prepare(page);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-export').click()]);
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.features).toEqual(data.features);
  expect(exported.inventory.items).toEqual(data.inventory.items);
});

test('PDF herda paleta e ornamentos sem mudar preferências; claro e escuro mantêm papel legível', async ({ page }) => {
  await importFilled(page, 'dnd2024');
  await page.evaluate(async () => (await import('/js/artwork.js')).applyArtworkPreferences({ artwork: { enabled: true, intensity: 'soft', selected: [{ id: 'dice-pair', position: 'left' }, { id: 'botanical-petals', position: 'center' }, { id: 'arcane-orbits', position: 'right' }] } }));
  const colors = new Set();
  for (const palette of ['classic', 'editorial', 'forest', 'ruby', 'monochrome', 'petals']) {
    let light;
    for (const theme of ['light', 'dark']) {
      await page.evaluate(async ({ palette, theme }) => { const api = await import('/js/theme.js'); api.applyPalette(palette); api.applyTheme(theme); }, { palette, theme });
      const before = await snapshot(page);
      await prepare(page); await page.emulateMedia({ media: 'print' });
      const root = page.locator('#print-root');
      await expect(root.locator('.print-heading__art svg')).toHaveCount(3);
      await expect(root.locator('img')).toHaveCount(1);
      const geometry = await root.locator('.print-heading').evaluate(header => {
        const text = header.querySelector('.print-heading__text').getBoundingClientRect();
        return [...header.querySelectorAll('svg, img')].every(el => { const r = el.getBoundingClientRect(); return r.right <= text.left || r.left >= text.right || r.bottom <= text.top || r.top >= text.bottom; });
      });
      expect(geometry).toBe(true);
      const accent = await root.locator('h2').first().evaluate(el => getComputedStyle(el).color);
      await expect(root.locator('h1')).toHaveCSS('color', await root.evaluate(el => getComputedStyle(el).color));
      if (theme === 'light') light = accent; else expect(accent).toBe(light);
      colors.add(accent);
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      expect(await snapshot(page)).toEqual(before);
    }
  }
  expect(colors.size).toBe(6);
});
