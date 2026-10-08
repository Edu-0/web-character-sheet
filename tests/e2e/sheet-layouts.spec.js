import { test, expect } from '@playwright/test';

const host = '#generic-sheet-host';
const select = '#sheet-layout-select';
async function openSystem(page, name) {
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText(name);
}
async function values(page) {
  return page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get()));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(select)).toHaveValue('dnd2024-layout', { timeout: 15_000 });
  await expect(page.locator(host).getByRole('tab', { name: 'Identidade', exact: true })).toBeVisible();
});

test('mesa, completo, estática e comparação compartilham edição e identidade', async ({ page }) => {
  await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Guardiã da Mesa');
  const id = (await values(page)).meta.id;
  await page.locator(select).selectOption('dnd2024-table');
  await page.locator(host).getByRole('tab', { name: 'Em jogo', exact: true }).click();
  await page.locator(host).getByLabel('PV Atual', { exact: true }).fill('17');
  await page.getByRole('button', { name: 'Comparar lado a lado', exact: true }).click();
  await expect(page.locator('[data-bind="combat.hpCurrent"]')).toHaveValue('17');
  await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Identidade', exact: true }).click();
  await page.locator('[data-bind="combat.hpCurrent"]').fill('12');
  await expect(page.locator(host).getByLabel('PV Atual', { exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Ficha estática', exact: true }).click();
  await expect(page.locator(host)).toBeHidden();
  await page.locator(select).selectOption('dnd2024-layout');
  await expect(page.locator('#legacy-dnd-sheet')).toBeHidden();
  await page.locator(host).getByRole('tab', { name: 'Identidade', exact: true }).click();
  await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Guardiã da Mesa');
  await expect(page.locator(host).getByLabel('PV Atual', { exact: true })).toHaveValue('12');
  expect((await values(page)).meta.id).toBe(id);
});

test('escolha persiste por sistema e acompanha backup sem entrar no personagem', async ({ page }) => {
  await page.locator(select).selectOption('dnd2024-table');
  await openSystem(page, 'Sistema de RPG');
  await expect(page.locator(select)).toHaveValue('sistema-rpg-layout');
  await page.locator(select).selectOption('sistema-rpg-table');
  await page.locator(host).getByRole('tab', { name: 'Notas', exact: true }).click();
  await page.locator(host).locator('textarea:visible').fill('Registro da sessão');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(page.locator(select)).toHaveValue('sistema-rpg-table');
  await expect(page.locator(host).locator('textarea:visible')).toHaveValue('Registro da sessão');
  await openSystem(page, 'D&D 5e (2024)');
  await expect(page.locator(select)).toHaveValue('dnd2024-table');
  const backup = await page.evaluate(async () => (await import('/js/library-backup.js')).exportLibrary((await import('/js/state.js')).state.get()));
  expect(backup.preferences.layoutSelections).toEqual(expect.arrayContaining([
    { systemId: 'dnd2024', layoutId: 'dnd2024-table' }, { systemId: 'sistema-rpg', layoutId: 'sistema-rpg-table' },
  ]));
  expect(backup.characters.every(character => !Object.hasOwn(character, 'layoutSelections'))).toBe(true);
  await page.evaluate(async backup => {
    const storage = await import('/js/storage.js');
    await storage.saveSettings({});
    await (await import('/js/library-backup.js')).restoreLibrary(backup, { overwriteConflicts: true, confirmed: true });
  }, backup);
  await page.reload();
  await expect(page.locator(select)).toHaveValue('dnd2024-table');
});

test('busca em mesa encontra campo omitido e abre o layout correspondente', async ({ page }) => {
  await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Viajante de layout');
  await page.locator(select).selectOption('dnd2024-table');
  await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveCount(0);
  await page.locator('#sheet-search-input').fill('Viajante de layout');
  await page.locator('#sheet-search-list button').filter({ hasText: 'Nome do personagem' }).first().click();
  await expect(page.locator(select)).toHaveValue('dnd2024-layout');
  await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toBeVisible();
  await expect(page.locator('#sheet-search-results')).toBeHidden();
});

test('impressão completa não perde campos ausentes no modo mesa', async ({ page }) => {
  await page.locator(host).getByRole('tab', { name: 'Personalidade', exact: true }).click();
  await page.locator(host).getByLabel('História', { exact: true }).fill('História que deve ir ao papel');
  await page.locator(select).selectOption('dnd2024-table');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root')).toContainText('História que deve ir ao papel');
  await expect(page.locator(select)).toHaveValue('dnd2024-table');
});

test('descanso em mesa altera o mesmo recurso e desfazer continua após trocar layout', async ({ page }) => {
  await page.locator(select).selectOption('dnd2024-table');
  await page.locator(host).getByRole('tab', { name: 'Em jogo', exact: true }).click();
  await page.locator(host).getByLabel('PV Atual', { exact: true }).fill('2');
  await page.locator(host).getByLabel('PV Máximo', { exact: true }).fill('20');
  await page.locator(host).getByRole('button', { name: 'Descanso longo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Aplicar recuperação', exact: true }).click();
  expect((await values(page)).combat.hpCurrent).toBe(20);
  await page.keyboard.press('Escape');
  await page.locator(select).selectOption('dnd2024-layout');
  await page.locator(host).getByRole('tab', { name: 'Identidade', exact: true }).click();
  await page.locator(host).getByRole('button', { name: 'Desfazer recuperação', exact: true }).click();
  expect((await values(page)).combat.hpCurrent).toBe(2);
});

test('pacote importado permite layouts arbitrários; preferência removida volta ao primeiro', async ({ page }, testInfo) => {
  const systemId = 'multiple-test';
  const layout = (id, label, field, mode = 'sheet') => ({ schemaVersion: 1, id, name: label, mode, system: systemId, tabs: [
    { id: 'main', label: 'Principal', sections: [{ id: 'main', containers: [{ components: [{ type: 'text', field, label }] }] }] },
  ] });
  const pkg = { schemaVersion: 1, kind: 'rpg-system-package', system: { schemaVersion: 1, id: systemId, name: 'Múltiplos', characterTemplate: { schemaVersion: 1, meta: { system: systemId }, name: '', notes: '' } },
    layouts: [layout('full', 'Criação', 'name'), layout('play', 'Consulta', 'notes', 'table'), layout('other', 'Anotações', 'notes'), layout('monk', 'Monge · Ki e disciplina', 'notes')] };
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({ name: 'multiple.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await page.locator('#systems-list .library-card').filter({ hasText: 'Múltiplos' }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await page.locator(host).getByLabel('Criação', { exact: true }).fill('Exploradora');
  await page.locator(select).selectOption('play');
  await page.locator(host).getByLabel('Consulta', { exact: true }).fill('Dados compartilhados');
  await page.locator(select).selectOption('other');
  await expect(page.locator(host).getByLabel('Anotações', { exact: true })).toHaveValue('Dados compartilhados');
  await page.reload();
  await expect(page.locator(select)).toHaveValue('other');
  expect((await values(page)).name).toBe('Exploradora');
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(page.locator(select).locator('option')).toHaveCount(4);
  await page.locator(select).selectOption('monk');
  await expect(page.locator(host).getByLabel('Monge · Ki e disciplina', { exact: true })).toHaveValue('Dados compartilhados');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('four-layouts-long-name-mobile.png'), fullPage: false });
  await page.evaluate(async () => {
    const storage = await import('/js/storage.js');
    await storage.saveSettings({ ...storage.loadSettings(), layoutSelections: [{ systemId: 'multiple-test', layoutId: 'removed-layout' }] });
  });
  await page.reload();
  await expect(page.locator(select)).toHaveValue('full');
  await expect(page.locator(host).getByLabel('Criação', { exact: true })).toHaveValue('Exploradora');
});

test('validação rejeita metadados inválidos de layout', async ({ page }) => {
  const issues = await page.evaluate(async () => {
    const pkg = await (await import('/js/repositories/system-repository.js')).getSystemPackage('dnd2024');
    pkg.layouts[0].mode = 'unknown'; pkg.layouts[0].name = 4;
    return (await import('/js/validation/schemas.js')).validateSystemPackage(pkg);
  });
  expect(issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['package.layouts[0].mode', 'package.layouts[0].name']));
});

for (const width of [360, 1280]) for (const theme of ['light', 'dark']) test(`mesa em ambos os sistemas: ${width}px ${theme}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async mode => {
    (await import('/js/theme.js')).applyTheme(mode);
  }, theme);
  for (const [system, id] of [['D&D 5e (2024)', 'dnd2024'], ['Sistema de RPG', 'sistema-rpg']]) {
    if (id === 'sistema-rpg') await openSystem(page, system);
    await page.locator(select).selectOption(`${id}-table`);
    await page.locator(host).getByRole('tab', { name: 'Em jogo', exact: true }).click();
    const tabs = page.locator(host).getByRole('tab');
    for (let i = 0; i < await tabs.count(); i++) {
      await tabs.nth(i).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.locator(host).getByRole('tab', { name: 'Em jogo', exact: true }).click();
    await expect(page.locator(select)).toBeVisible();
    const box = await page.locator(select).boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`${id}-mesa-${width}-${theme}.png`), fullPage: true });
  }
});
