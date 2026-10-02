import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('ficha-rpg:settings')) localStorage.setItem('ficha-rpg:settings', JSON.stringify({ showCalculationControls: true }));
  });
});

async function openAdjustment(scope, label) {
  const control = scope.locator('.engine-calculation-control').filter({ hasText: `Ajustar ${label}` });
  await control.locator('summary').click();
  return control;
}

test('D&D propaga ajustes e conserva valor fixo, rolagem, JSON e sincronização', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const sheet = page.locator('#generic-sheet-host');
  const ability = sheet.locator('.engine-dnd-ability').first();
  const control = await openAdjustment(ability, 'Modificador de Força');
  await control.getByRole('combobox').selectOption('adjust');
  await control.getByRole('spinbutton').fill('2');
  await ability.getByRole('spinbutton', { name: 'Valor de Força' }).fill('16');
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('+5');
  await expect(ability.locator('.engine-dnd-ability__save-roll')).toHaveText('+5');
  await expect(sheet.getByRole('button', { name: 'Rolar Atletismo', exact: true })).toHaveText('+5');
  await control.getByRole('combobox').selectOption('fixed');
  await control.getByRole('spinbutton').fill('-1');
  await ability.getByRole('spinbutton', { name: 'Valor de Força' }).fill('18');
  await ability.getByRole('button', { name: 'Rolar teste de Força' }).click();
  await expect(page.locator('#dice-result')).toContainText('-1');
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  await expect(page.locator('#abilities-grid [data-ability="str"] [data-el="modifier"]')).toHaveText('-1');
  await expect(page.locator('.engine-die-steps')).toHaveCount(0);
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('-1');
  const downloading = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const json = JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
  expect(json.calculationOverrides['dnd.ability.str']).toEqual({ mode: 'fixed', value: -1 });
  await page.locator('#input-import-file').setInputFiles({ name: 'ajuste.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('-1');
  const legacy = page.locator('#abilities-grid [data-ability="str"]');
  const legacyControl = await openAdjustment(legacy, 'Modificador de Força');
  await legacyControl.getByRole('button', { name: 'Voltar ao automático' }).click();
  await expect(ability.locator('.engine-dnd-ability__modifier')).toHaveText('+4');
  await expect(legacy.locator('[data-el="modifier"]')).toHaveText('+4');
});

function packageFixture() {
  return { schemaVersion: 1, kind: 'rpg-system-package', system: {
    schemaVersion: 1, id: 'step-test', name: 'Teste de passos', diceSteps: true, dieScale: [4, 6, 8, 10, 12],
    formulas: { total: 'base * 2' },
    characterTemplate: { schemaVersion: 1, meta: { system: 'step-test' }, name: 'Passos', base: 3, trait: 8, compound: { dice: [{ sides: 12 }, { sides: 6 }] }, items: [{ id: 'one', die: 8 }] },
  }, layouts: [{ schemaVersion: 1, id: 'default', system: 'step-test', tabs: [{ id: 'main', label: 'Principal', sections: [{ id: 'main', containers: [{ layout: { type: 'grid', min: 160 }, components: [
    { type: 'number', field: 'base', label: 'Base' },
    { type: 'computed', formula: 'total', overrideKey: 'total', label: 'Total', variables: { base: { field: 'base' } } },
    { type: 'computed', formula: 'total', override: false, label: 'Sem ajuste', variables: { base: { field: 'base' } } },
    { type: 'die', field: 'trait', label: 'Traço' }, { type: 'die', field: 'compound', label: 'Composto', allowComposite: true },
    { type: 'die', field: 'trait', label: 'Sem passos', stepControls: false },
    { type: 'list', field: 'items', label: 'Itens', itemSchema: { die: { type: 'die', label: 'Dado do item' } } },
  ] }] }] }] }] };
}

async function importFixture(page) {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({ name: 'steps.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(packageFixture())) });
  await page.locator('#systems-list .library-card').filter({ hasText: 'Teste de passos' }).getByRole('button', { name: 'Abrir', exact: true }).click();
}

test('sistema importado oferece override, busca e passos individuais persistidos', async ({ page }) => {
  await importFixture(page);
  const sheet = page.locator('#generic-sheet-host');
  const total = sheet.locator('.engine-computed').first();
  const control = await openAdjustment(total, 'Total');
  await control.getByRole('combobox').selectOption('adjust');
  await control.getByRole('spinbutton').fill('-2.5');
  await sheet.getByLabel('Base', { exact: true }).fill('10');
  await expect(total.locator('.engine-computed__value')).toHaveText('17,5');
  await control.getByRole('combobox').selectOption('fixed');
  await control.getByRole('spinbutton').fill('0');
  await sheet.getByLabel('Base', { exact: true }).fill('20');
  await expect(total.locator('.engine-computed__value')).toHaveText('0');
  await expect(sheet.getByText('Ajustar Sem ajuste', { exact: true })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Subir Sem passos', exact: true })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Descer Traço', exact: true }).click();
  await expect(sheet.getByLabel('Traço', { exact: true })).toHaveValue('6');
  await sheet.getByRole('button', { name: 'Descer Traço', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Descer Traço', exact: true })).toBeDisabled();
  await expect(sheet.getByRole('button', { name: 'Subir dado 1 de Composto', exact: true })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Descer dado 1 de Composto', exact: true }).click();
  await sheet.getByRole('button', { name: 'Subir dado 2 de Composto', exact: true }).click();
  await expect(sheet.getByLabel('Composição de Composto')).toHaveValue('d10 + d8');
  await sheet.getByRole('button', { name: 'Subir Dado do item', exact: true }).click();
  await expect(sheet.getByLabel('Dado do item', { exact: true })).toHaveValue('10');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(total.locator('.engine-computed__value')).toHaveText('0');
  await expect(sheet.getByLabel('Traço', { exact: true })).toHaveValue('4');
  const results = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { getSystemPackage } = await import('/js/repositories/system-repository.js');
    const pkg = await getSystemPackage('step-test');
    const { getFieldType } = await import('/js/engine/fields.js');
    const context = { ...pkg.layouts[0].tabs[0].sections[0].containers[0].components[1], character: state.get(), system: pkg.system };
    return { search: getFieldType('computed').search(context)[0].value, character: state.get() };
  });
  expect(results.search).toBe('0');
  expect(results.character.compound.dice).toEqual([{ sides: 10 }, { sides: 8 }]);
  expect(results.character).not.toHaveProperty('progression');
  const printResult = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { getSystemPackage } = await import('/js/repositories/system-repository.js');
    const pkg = await getSystemPackage('step-test');
    const { buildPrintSheet } = await import('/js/engine/print-sheet.js');
    const print = buildPrintSheet(pkg.layouts[0], state.get(), pkg.system);
    return { text: print.textContent, controls: print.querySelectorAll('.engine-calculation-control').length };
  });
  expect(printResult.text).toContain('Total0');
  expect(printResult.controls).toBe(0);
});

test('validação rejeita overrides inválidos, IDs perigosos e escalas incompatíveis', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const results = await page.evaluate(async pkg => {
    const { validateSystemPackage, validateCharacter } = await import('/js/validation/schemas.js');
    const character = { ...pkg.system.characterTemplate, meta: { id: 'validation', system: 'step-test' }, calculationOverrides: { 'computed.total': { mode: 'fixed', value: '4' } } };
    const invalidValue = validateCharacter(character).length;
    character.calculationOverrides['computed.total'] = { mode: 'other', value: 4 };
    const invalidMode = validateCharacter(character).length;
    pkg.system.dieScale = [8, 6, 8];
    const invalidScale = validateSystemPackage(pkg).length;
    pkg.system.diceSteps = false;
    pkg.layouts[0].tabs[0].sections[0].containers[0].components[3].stepControls = true;
    const invalidFieldScale = validateSystemPackage(pkg).length;
    pkg.system.dieScale = [4, 6, 8];
    pkg.layouts[0].tabs[0].sections[0].containers[0].components[1].overrideKey = '__proto__.bad';
    return [invalidValue, invalidMode, invalidScale, invalidFieldScale, validateSystemPackage(pkg).length];
  }, packageFixture());
  results.forEach(value => expect(value).toBeGreaterThan(0));
});

for (const theme of ['light', 'dark']) test(`ajustes abertos e passos cabem no celular e desktop em ${theme}`, async ({ page }, testInfo) => {
  await importFixture(page);
  await page.evaluate(async theme => (await import('/js/theme.js')).applyTheme(theme), theme);
  const control = await openAdjustment(page.locator('.engine-computed').first(), 'Total');
  await control.getByRole('combobox').selectOption('adjust');
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`steps-${theme}-${width}.png`), fullPage: true });
  }
});


test('catálogo e carga usam passos e overrides sem lançar evolução', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await page.getByRole('tab', { name: 'Perícias', exact: true }).click();
  await page.getByRole('button', { name: 'Editar perícias', exact: true }).click();
  await page.getByRole('button', { name: 'Subir Atletismo', exact: true }).click();
  await expect(page.getByLabel('Atletismo', { exact: true })).toHaveValue('6');
  await page.getByRole('button', { name: 'Descer Atletismo', exact: true }).click();
  await expect(page.getByLabel('Atletismo', { exact: true })).toHaveValue('4');
  await expect(page.getByRole('button', { name: 'Descer Atletismo', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Inventário', exact: true }).click();
  const summary = page.locator('.engine-inventory-summary');
  const control = await openAdjustment(summary, 'Capacidade de carga');
  await control.getByRole('combobox').selectOption('fixed');
  await control.getByRole('spinbutton').fill('1');
  await expect(summary.locator('output[aria-label="Capacidade de carga"]')).toContainText('1 kg');
  const character = await page.evaluate(async () => (await import('/js/state.js')).state.get());
  expect(character.skills).not.toHaveProperty('Atletismo');
  expect(character.calculationOverrides['computed.carryCapacity']).toEqual({ mode: 'fixed', value: 1 });
  const capacityResult = await page.evaluate(async () => {
    const { getSystemPackage } = await import('/js/repositories/system-repository.js');
    const { state } = await import('/js/state.js');
    const { computedValue } = await import('/js/engine/advanced-fields.js');
    const pkg = await getSystemPackage('sistema-rpg');
    const component = pkg.layouts[0].tabs.flatMap(tab => tab.sections.flatMap(section => section.containers.flatMap(container => container.components))).find(component => component.type === 'computed' && component.formula === 'carryCapacity');
    return computedValue({ ...component, system: pkg.system, character: state.get() });
  });
  expect(capacityResult).toBe(1);
  expect(character.progression?.history || []).toHaveLength(0);
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(summary.locator('output[aria-label="Capacidade de carga"]')).toContainText('1 kg');
  const restored = await openAdjustment(summary, 'Capacidade de carga');
  await restored.getByRole('button', { name: 'Voltar ao automático' }).click();
  await expect(summary.locator('output[aria-label="Capacidade de carga"]')).not.toHaveText('1 kg de capacidade');
});

for (const theme of ['light', 'dark']) test(`D&D com ajustes abertos cabe nas apresentações em ${theme}`, async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.evaluate(async theme => (await import('/js/theme.js')).applyTheme(theme), theme);
  for (const presentation of ['Ficha modular', 'Ficha estática']) {
    await page.getByRole('button', { name: presentation, exact: true }).click();
    const scope = page.locator(presentation === 'Ficha modular' ? '#generic-sheet-host' : '#legacy-dnd-sheet');
    const control = await openAdjustment(scope, 'Modificador de Força');
    await control.getByRole('combobox').selectOption('adjust');
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const card = scope.locator(presentation === 'Ficha modular' ? '.engine-dnd-ability' : '.ability-card').first();
      expect(await card.locator('.engine-calculation-control').first().evaluate(el => el.clientWidth)).toBeGreaterThan(180);
      await card.screenshot({ path: testInfo.outputPath(`card-${presentation}-${theme}-${width}.png`) });
      await page.screenshot({ path: testInfo.outputPath(`dnd-${presentation}-${theme}-${width}.png`), fullPage: true });
    }
  }
});


test('modo fixo independe de fórmula indisponível e bloqueios conservam os extremos', async ({ page }) => {
  await importFixture(page);
  const result = await page.evaluate(async () => {
    const { computedValue } = await import('/js/engine/advanced-fields.js');
    const { renderSheet } = await import('/js/engine/renderer.js');
    const context = { formula: 'broken', system: { formulas: { broken: '1 / 0' } }, character: { calculationOverrides: { 'computed.broken': { mode: 'fixed', value: 0 } } } };
    const fixed = computedValue(context);
    const { calculationValue } = await import('/js/engine/calculation-overrides.js');
    if (calculationValue({ calculationOverrides: {} }, 'toString', 3) !== 3) throw new Error('Cálculo não deve ler exceções herdadas.');
    const system = { name: 'Limites', dieScale: [4, 6, 8], diceSteps: true };
    const character = { name: 'Limites', die: 4, locked: false };
    const host = document.createElement('div'); host.id = 'step-limit-test'; document.body.append(host);
    const components = [{ type: 'die', field: 'die', label: 'Limite', disabledWhen: { field: 'locked', equals: true } }, { type: 'boolean', field: 'locked', label: 'Bloqueado' }];
    const layout = { id: 'limits', tabs: [{ id: 'main', label: 'Limites', sections: [{ containers: [{ components }] }] }] };
    renderSheet(host, layout, character, { system });
    return fixed;
  });
  expect(result).toBe(0);
  const host = page.locator('#step-limit-test');
  await expect(host.getByRole('button', { name: 'Descer Limite' })).toBeDisabled();
  await host.getByLabel('Bloqueado').check();
  await expect(host.getByRole('button', { name: 'Subir Limite' })).toBeDisabled();
  await host.getByLabel('Bloqueado').uncheck();
  await expect(host.getByRole('button', { name: 'Descer Limite' })).toBeDisabled();
  await host.getByRole('button', { name: 'Subir Limite' }).click();
  await expect(host.getByLabel('Limite', { exact: true })).toHaveValue('6');
});
