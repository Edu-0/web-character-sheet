import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { populate, longText } from '../design-fixtures.mjs';

const prepare = page => page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
const profile = (page, value) => page.evaluate(async value => {
  const api = await import('/js/storage.js');
  api.saveSettings({ ...api.loadSettings(), printProfile: value });
}, value);
const data = page => page.evaluate(async () => JSON.stringify((await import('/js/state.js')).state.get()));

async function filled(page, id) {
  if (id === 'sistema-rpg') {
    await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
    await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir', exact: true }).click();
    await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
  }
  const value = populate(JSON.parse(await data(page)), id);
  await page.locator('#input-import-file').setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await expect(page.locator('#shell-current-character')).toContainText('Lia');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('escolha de formato: cancelar preserva preferências, confirmar persiste e teclado usa a escolha', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  const before = await page.evaluate(() => localStorage.getItem('ficha-rpg:settings'));
  const open = async () => { await page.getByRole('button', { name: 'Mais', exact: true }).click(); await page.locator('#btn-print').click(); };
  await open();
  const dialog = page.getByRole('dialog', { name: 'Imprimir / salvar PDF' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: /^Completo/ })).toBeChecked();
  await dialog.getByRole('radio', { name: /^Compacto/ }).check();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#btn-more')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('ficha-rpg:settings'))).toBe(before);
  await open(); await expect(dialog.getByRole('radio', { name: /^Completo/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await open(); await dialog.getByRole('radio', { name: /^Compacto/ }).check();
  expect(await dialog.evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await page.evaluate(() => { window.print = () => { window.dispatchEvent(new Event('beforeprint')); window.__printedProfile = document.querySelector('.print-sheet').dataset.printProfile; window.dispatchEvent(new Event('afterprint')); }; });
  await dialog.getByRole('button', { name: 'Imprimir / salvar PDF', exact: true }).click();
  expect(await page.evaluate(() => window.__printedProfile)).toBe('compact');
  const settings = JSON.parse(await page.evaluate(() => localStorage.getItem('ficha-rpg:settings')));
  expect(settings).toEqual({ ...JSON.parse(before), printProfile: 'compact' });
  await page.reload();
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await prepare(page);
  await expect(page.locator('.print-sheet')).toHaveAttribute('data-print-profile', 'compact');
  await expect(page.locator('.print-heading__caption')).toContainText('versão de consulta');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await open(); await expect(dialog.getByRole('radio', { name: /^Compacto/ })).toBeChecked();
});

for (const id of ['dnd2024', 'sistema-rpg']) test(`${id}: PDFs completo e compacto, dados preservados e coleções sem duplicação`, async ({ page }) => {
  test.setTimeout(60_000);
  await filled(page, id);
  const before = await data(page);
  await mkdir('output/pdf/profiles', { recursive: true });
  let fullCoins;
  for (const mode of ['full', 'compact']) {
    await profile(page, mode); await prepare(page);
    const root = page.locator('#print-root');
    const text = await root.textContent();
    expect(text.includes(longText)).toBe(mode === 'full');
    expect(text).toContain('Equipamento 42');
    expect(text.split('Equipamento 42').length - 1).toBe(1);
    await expect(root.locator('button, input, textarea, select, [id]')).toHaveCount(0);
    if (id === 'dnd2024') {
      const spells = root.locator('.print-wide').filter({ has: page.locator('h4', { hasText: /^Magias$/ }) });
      if (mode === 'compact') {
        await expect(spells.locator('th')).toHaveText(['Nome', 'Nível']);
        await expect(spells).toContainText('Luz da jornada');
        await expect(spells).toContainText('Truque');
        expect(text).not.toContain('FIM DA MAGIA.');
      } else expect(text).toContain('FIM DA MAGIA.');
      await page.emulateMedia({ media: 'print' });
      const height = await root.locator('.print-section').filter({ has: page.locator('h3', { hasText: /^Moedas$/ }) }).evaluate(el => el.getBoundingClientRect().height);
      if (mode === 'full') fullCoins = height; else expect(height).toBeLessThan(fullCoins);
      await page.emulateMedia({ media: null });
    } else {
      expect(text).toContain('d12 + d6'); expect(text).toContain('7 / 16');
      expect(text).toContain('Energia paga: 2'); expect(text).toContain('Concentração:');
      if (mode === 'compact') expect(text).not.toContain('ÚLTIMO ITEM DO INVENTÁRIO');
    }
    await page.pdf({ path: `output/pdf/profiles/${id}-${mode}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    expect(await data(page)).toBe(before);
  }
  if (id === 'dnd2024') {
    let content;
    for (const mode of ['legacy', 'engine', 'compare']) {
      await page.locator(`[data-dnd-presentation="${mode}"]`).click(); await prepare(page);
      const current = await page.locator('#print-root').textContent();
      if (content) expect(current).toBe(content); else content = current;
    }
  }
});

test('sistema importado configura resumo sem nomes D&D, mantém fallback e rejeita campos inválidos', async ({ page }) => {
  const system = { schemaVersion: 1, id: 'perfil-generico', name: 'Registro espacial', characterTemplate: { schemaVersion: 1, meta: { system: 'perfil-generico' }, name: 'Ada', cargo: [{ title: 'Gerador', tier: 'Classe C', detail: 'DETALHE COMPLETO' }], journal: `DIÁRIO SEM RESUMO\n${longText}`, private: 'SEÇÃO OMITIDA' } };
  const layout = { schemaVersion: 1, id: 'perfil-layout', system: system.id, tabs: [{ id: 'main', label: 'Viagem', sections: [
    { id: 'cargo', title: 'Carga', containers: [{ components: [{ type: 'list', field: 'cargo', label: 'Módulos', print: { compact: { fields: ['title', 'tier'], presentation: 'table' } }, itemSchema: { title: { type: 'text', label: 'Módulo' }, tier: { type: 'text', label: 'Classe' }, detail: { type: 'text', label: 'Detalhes' } } }, { type: 'textarea', field: 'journal', label: 'Diário' }] }] },
    { id: 'private', title: 'Anexo', print: { compact: { include: false } }, containers: [{ components: [{ type: 'text', field: 'private', label: 'Anexo integral' }] }] },
  ] }] };
  const issues = await page.evaluate(async layout => {
    const { validateLayout } = await import('/js/validation/schemas.js');
    const bad = structuredClone(layout); bad.tabs[0].sections[0].containers[0].components[0].print.compact.fields = ['missing'];
    return validateLayout(bad);
  }, layout);
  expect(issues[0].path).toContain('print.compact.fields[0]');
  await page.locator('#input-import-system').setInputFiles({ name: 'profiles.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ kind: 'rpg-system-package', schemaVersion: 1, system, layouts: [layout] })) });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Registro espacial' }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Registro espacial');
  await profile(page, 'compact'); await prepare(page);
  const root = page.locator('#print-root');
  await expect(root).toContainText('Gerador'); await expect(root).toContainText('Classe C');
  await expect(root).toContainText('DIÁRIO SEM RESUMO');
  expect(await root.textContent()).not.toContain('DETALHE COMPLETO');
  expect(await root.textContent()).not.toContain('SEÇÃO OMITIDA');
  await profile(page, 'full'); await prepare(page);
  await expect(root).toContainText('DETALHE COMPLETO'); await expect(root).toContainText('SEÇÃO OMITIDA');
  await mkdir('output/pdf/profiles', { recursive: true });
  for (const mode of ['full', 'compact']) {
    await profile(page, mode);
    await page.pdf({ path: `output/pdf/profiles/imported-${mode}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  }
});
