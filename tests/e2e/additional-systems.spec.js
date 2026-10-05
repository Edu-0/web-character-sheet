import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('data/systems/index.json', 'utf8'));
const systems = manifest.systems.filter(entry => !['dnd2024', 'sistema-rpg'].includes(entry.id));
const data = page => page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get()));
async function open(page, name) {
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText(name);
}

test('checkRoll importado relê fontes, ajustes, listas e desfazer sem gravar rolagens @smoke', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const pkg = JSON.parse(readFileSync('data/examples/check-rolls.package.json', 'utf8'));
  pkg.system.formulas.adjusted = '6 / score'; // Pode ficar indisponível ao editar a base.
  await page.addInitScript(() => localStorage.setItem('ficha-rpg:settings', JSON.stringify({showCalculationControls:true})));
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({ name: 'checks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await open(page, pkg.system.name);
  const host = page.locator('#generic-sheet-host'), check = host.locator('.engine-check');
  const select = check.getByLabel('Fonte do teste'), output = check.getByRole('status');
  await page.evaluate(() => { crypto.getRandomValues = array => array.fill(Math.floor(0.5 * 0x100000000)); }); // Quatro faces neutras.
  await host.getByLabel('Base', { exact: true }).fill('5');
  await expect(select.locator('option').first()).toHaveText('Base (5)');
  await check.getByRole('button', { name: 'Rolar teste' }).click();
  await expect(output).toContainText('Base: 5 · Sucesso com estilo');
  await page.locator('#btn-undo-edit').click();
  await expect(host.getByLabel('Base', { exact: true })).toHaveValue('2');
  await select.selectOption('1');
  const adjustment = host.locator('.engine-calculation-control').filter({hasText:'Ajustar Total ajustado'});
  await adjustment.locator('summary').click();
  await adjustment.getByRole('combobox').selectOption('fixed');
  await adjustment.getByRole('spinbutton').fill('7');
  await expect(select.locator('option:checked')).toHaveText('Total ajustado (7)');
  await check.getByRole('button', { name: 'Rolar teste' }).click();
  await expect(output).toContainText('Total ajustado: 7');
  await host.getByLabel('Base', {exact:true}).fill('0');
  await expect(select.locator('option:checked')).toHaveText('Total ajustado (7)');
  await check.getByRole('button', { name: 'Rolar teste' }).click();
  await expect(output).toContainText('Total ajustado: 7');
  await adjustment.getByRole('combobox').selectOption('auto');
  await expect(select.locator('option:checked')).toHaveText('Total ajustado (indisponível)');
  await check.getByRole('button', { name: 'Rolar teste' }).click();
  await expect(output).toContainText('Fórmula deve produzir');
  await select.selectOption('0');
  await check.getByRole('button', { name: 'Rolar teste' }).click();
  await expect(output).toContainText('Base: 0 · Empate');
  await adjustment.getByRole('combobox').selectOption('fixed');
  await adjustment.getByRole('spinbutton').fill('7');
  await select.selectOption(JSON.stringify(['2','id','practice']));
  const skills = host.locator('[data-field="skills"]');
  await skills.getByRole('button', {name:'Adicionar',exact:true}).click();
  const practice = skills.locator('[data-entry-id="practice"]');
  if (!await practice.evaluate(node => node.open)) await practice.locator('summary').click();
  await practice.getByLabel('Nome da perícia', {exact:true}).fill('<img onerror=alert(1)>');
  await practice.getByLabel('Valor', {exact:true}).fill('4');
  await expect(select).toHaveValue(JSON.stringify(['2','id','practice']));
  const before = await data(page), history = await page.locator('#edit-history-status').textContent();
  await check.getByRole('button', { name: 'Rolar teste' }).click();
  await expect(output).toContainText('<img onerror=alert(1)>: 4');
  expect(await data(page)).toEqual(before);
  expect(await page.locator('#edit-history-status').textContent()).toBe(history);
  await expect(check.locator('img')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('.print-sheet')).toContainText('Total ajustado');
  await expect(page.locator('.print-sheet .engine-check')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(output).toBeEmpty();
  expect((await data(page)).skills).toEqual(before.skills);
  expect(errors).toEqual([]);
});
for (const system of systems) {
  test(`${system.id}: criar, editar, jogar, layouts, persistir e exportar @smoke`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
    const dnd = await data(page);
    await open(page, system.name);
    const host = page.locator('#generic-sheet-host');
    const name = `Teste ${system.id}`;
    await host.getByLabel('Nome do personagem', { exact: true }).fill(name);
    await page.locator('#sheet-layout-select').selectOption(`${system.id}-table`);
    const beforeRoll = await data(page);
    const checks = host.locator('.engine-check');
    for (let i = 0; i < await checks.count(); i++) {
      await checks.nth(i).getByRole('button', { name: 'Rolar teste', exact: true }).click();
      await expect(checks.nth(i).getByRole('status')).not.toBeEmpty();
      await expect(checks.nth(i).getByRole('status')).not.toContainText(/informe|Preencha|desconhecido/);
    }
    expect(await data(page)).toEqual(beforeRoll);
    await host.getByRole('tab', { name: 'Notas e cobertura', exact: true }).click();
    await host.getByLabel('Notas da sessão', { exact: true }).fill('Registro persistente');
    await expect(page.locator('#save-indicator')).toHaveText('Salvo');
    await page.reload();
    await expect(page.locator('#shell-current-character')).toHaveText(name);
    await expect(page.locator('#sheet-layout-select')).toHaveValue(`${system.id}-table`);
    await host.getByRole('tab', { name: 'Notas e cobertura', exact: true }).click();
    await expect(host.getByLabel('Notas da sessão', { exact: true })).toHaveValue('Registro persistente');
    const saved = await data(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export').click();
    const download = await downloadPromise;
    const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
    expect(exported.notes).toBe(saved.notes);
    expect(exported.meta.id).toBe(saved.meta.id);
    await page.locator('#input-import-file').setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await expect.poll(async () => (await data(page)).meta.id).not.toBe(saved.meta.id);
    expect((await data(page)).notes).toBe(saved.notes);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(page.locator('.print-sheet')).toContainText('Registro persistente');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await open(page, 'D&D 5e (2024)');
    expect((await data(page)).meta.id).toBe(dnd.meta.id);
    expect((await data(page)).identity).toEqual(dnd.identity);
    expect(errors).toEqual([]);
  });

  test(`${system.id}: temas, teclado e todas as abas em celular e desktop`, async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
    await open(page, system.name);
    const host = page.locator('#generic-sheet-host');
    for (const [width, theme] of [[1280, 'light'], [360, 'dark']]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const tabs = host.getByRole('tab');
      for (let i = 0; i < await tabs.count(); i++) {
        await tabs.nth(i).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${width}-${theme}-${i}.png`), fullPage: true });
      }
      await tabs.first().focus(); await page.keyboard.press('End');
      await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    }
  });
}
