import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync('data/examples/generic-entry-rolls.package.json', 'utf8'));
async function importFixture(page, pkg = structuredClone(fixture)) {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({ name: 'example.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await page.locator('#systems-list .library-card').filter({ hasText: pkg.system.name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText(pkg.system.name);
  await page.evaluate(() => { Math.random = () => 0.5; });
}
async function open(page, label = 'Ativar poder') {
  if (label === 'Lançar') {
    const entry = page.locator('#generic-sheet-host .engine-entry').filter({ hasText: 'Magia antiga' });
    if (await entry.getAttribute('open') === null) await entry.locator('summary').click();
  }
  await page.getByRole('button', { name: label, exact: true }).click();
  return page.getByRole('dialog');
}
const energy = page => page.evaluate(async () => (await import('/js/state.js')).state.get().energy);

test('terceiro sistema usa 2d6, fórmula da ficha, dados editáveis e modificador manual', async ({ page }) => {
  const pkg = structuredClone(fixture);
  pkg.system.entryRolls.skillCheck.check.modifier.overrideKey = 'computed.checkBonus';
  await importFixture(page, pkg);
  const dialog = await open(page, 'Usar técnica');
  await expect(dialog.getByLabel('Prévia da rolagem')).toContainText('Teste: 2d6 + 4');
  await dialog.getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('2d6 + 4 = 12');
  await expect(page.locator('#dice-result')).toHaveText('2d6 + 4 = 12');
  await expect(page.locator('#dice-history')).toContainText('Golpe de teste');
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('calculationOverrides', { 'computed.checkBonus': { mode: 'fixed', value: 6 } }));
  await dialog.getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('2d6 + 6 = 14');
  await expect(dialog.getByLabel('Consumir energia')).toHaveCount(0);
  await dialog.getByLabel('Dados do teste').fill('1d100');
  await dialog.getByLabel('Modificador do teste').fill('-2');
  await dialog.getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('1d100 - 2 = 49');
  await dialog.getByRole('button', { name: 'Rolar dano / efeito' }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('1d8 + 2 = 7');
  await dialog.getByLabel('Rolar teste', { exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('1d8 + 2 = 7');
});

test('bandeja pode ser desativada e um resolvedor ausente não causa erro de página', async ({ page }) => {
  const pkg = structuredClone(fixture);
  pkg.system.diceTray = false;
  pkg.system.entryRolls.power.effect.expression = { resolver: 'extension.unavailable' };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await importFixture(page, pkg);
  await expect(page.locator('#dice-tray')).toBeHidden();
  const dialog = await open(page);
  await expect(dialog).toContainText('Resolvedor indisponível: extension.unavailable');
  expect(await energy(page)).toBe(5);
  expect(errors).toEqual([]);
});

test('escala acima de 9 com passo 2 e custo de energia por entrada, sem teste obrigatório', async ({ page }) => {
  await importFixture(page);
  const dialog = await open(page);
  await expect(dialog.getByLabel('Rolar teste')).toHaveCount(0);
  await dialog.getByLabel('Potência', { exact: true }).selectOption('20');
  await expect(dialog.getByLabel('Prévia da rolagem')).toHaveText('Dano/efeito: 11d6 + 1');
  await expect(dialog.getByLabel('Consumir energia')).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('11d6 + 1 = 45');
  expect(await energy(page)).toBe(5);
  await dialog.getByLabel('Consumir energia').check();
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  expect(await energy(page)).toBe(3);
  await dialog.getByRole('button', { name: 'Rolar dano / efeito' }).click();
  expect(await energy(page)).toBe(3);
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  expect(await energy(page)).toBe(1);
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Recurso insuficiente');
  expect(await energy(page)).toBe(1);
  await expect(page.locator('#dice-history li')).toHaveCount(4);
});

test('dados e base inválidos não gastam energia nem gravam configurações', async ({ page }) => {
  await importFixture(page);
  let dialog = await open(page);
  await dialog.getByLabel('Consumir energia').check();
  await dialog.getByLabel('Dados de dano ou efeito').fill('alert(1)');
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(dialog.getByRole('alert')).not.toBeEmpty();
  expect(await energy(page)).toBe(5);
  expect(await page.evaluate(async () => (await import('/js/state.js')).state.get().powers[0].rollOptions)).toBeUndefined();
  await page.keyboard.press('Escape');
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('powers.0.grade', 3));
  dialog = await open(page);
  await expect(dialog.getByRole('alert')).toHaveText('Valor base fora da escala configurada.');
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  expect(await energy(page)).toBe(5);
  await expect(page.locator('#dice-history li')).toHaveCount(0);
});

test('consumo em lista usa os caminhos configurados', async ({ page }) => {
  const pkg = structuredClone(fixture);
  pkg.system.characterTemplate.charges = [{ rank: 2, spent: 0, limit: 2 }];
  pkg.system.entryRolls.power.resource = { field: 'charges', matchField: 'rank', valueField: 'spent', maxField: 'limit', mode: 'used', cost: { value: 1 } };
  await importFixture(page, pkg);
  const dialog = await open(page);
  await dialog.getByLabel('Consumir recurso').check();
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  expect(await page.evaluate(async () => (await import('/js/state.js')).state.get().charges[0].spent)).toBe(1);
  await dialog.getByLabel('Potência', { exact: true }).selectOption('4');
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Recurso indisponível');
  expect(await page.evaluate(async () => (await import('/js/state.js')).state.get().charges[0].spent)).toBe(1);
});

test('contador de usos mantém limite e recusa custo maior que o saldo', async ({ page }) => {
  const pkg = structuredClone(fixture);
  Object.assign(pkg.system.characterTemplate, { spent: 0, limit: 2 });
  pkg.system.entryRolls.power.resource = { field: 'spent', maxField: 'limit', mode: 'used', cost: { value: 2 } };
  await importFixture(page, pkg);
  const dialog = await open(page);
  await dialog.getByLabel('Consumir recurso').check();
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('0 / 2');
  expect(await page.evaluate(async () => (await import('/js/state.js')).state.get().spent)).toBe(2);
  await dialog.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Recurso insuficiente');
  expect(await page.evaluate(async () => (await import('/js/state.js')).state.get().spent)).toBe(2);
  await expect(page.locator('#dice-history li')).toHaveCount(1);
});

test('configuração neutra persiste e acompanha exportação do sistema e personagem', async ({ page }) => {
  await importFixture(page);
  const dialog = await open(page, 'Usar técnica');
  await dialog.getByLabel('Dados do teste').fill('3d6');
  await dialog.getByLabel('Modificador do teste').fill('+7');
  await dialog.getByRole('button', { name: 'Salvar configuração' }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  const restored = await open(page, 'Usar técnica');
  await expect(restored.getByLabel('Dados do teste')).toHaveValue('3d6');
  await expect(restored.getByLabel('Modificador do teste')).toHaveValue('+7');
  await page.keyboard.press('Escape');
  const download = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const character = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(character.techniques[0].rollOptions).toMatchObject({ checkEnabled: true, checkExpression: '3d6', modifier: '+7' });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  const packageDownload = page.waitForEvent('download');
  await page.locator('#systems-list .library-card').filter({ hasText: fixture.system.name }).getByRole('button', { name: 'Exportar', exact: true }).click();
  expect(JSON.parse(await readFile(await (await packageDownload).path(), 'utf8')).system.entryRolls).toEqual(fixture.system.entryRolls);
});

test('D&D migra opções antigas preservando modificador, efeito e aumento', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('spellcasting.spells', [{ id: 'legacy-spell', name: 'Magia antiga', level: 1, rollOptions: { attack: true, attackModifier: '+9', effect: '3d6 + 4', upcast: '2d6' } }]));
  await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Magias', exact: true }).click();
  const dialog = await open(page, 'Lançar');
  await expect(dialog.getByLabel('Rolar ataque', { exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Modificador do ataque')).toHaveValue('+9');
  await dialog.getByLabel('Nível do espaço').selectOption('3');
  await expect(dialog.getByLabel('Prévia da rolagem')).toContainText('7d6 + 4');
  await dialog.getByRole('button', { name: 'Salvar configuração' }).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Magias', exact: true }).click();
  const restored = await open(page, 'Lançar');
  await expect(restored.getByLabel('Modificador do ataque')).toHaveValue('+9');
  await expect(restored.getByLabel('Dados adicionais por nível de espaço')).toHaveValue('2d6');
});

test('pacote com nomes anteriores importa, rola e salva opções com nomenclatura atual', async ({ page }) => {
  const pkg = structuredClone(fixture);
  for (const preset of Object.values(pkg.system.entryRolls)) if (preset.check) {
    preset.test = preset.check; delete preset.check;
  }
  for (const component of pkg.layouts[0].tabs[0].sections[0].containers[0].components) if (component.rollPreset) {
    component.rollConfigFrom = component.rollPreset; delete component.rollPreset;
  }
  pkg.system.characterTemplate.techniques[0].rollOptions = { testEnabled: true, testExpression: '3d6', modifier: '+2', effect: '1d8', increment: '' };
  await importFixture(page, pkg);
  const dialog = await open(page, 'Usar técnica');
  await expect(dialog.getByLabel('Dados do teste')).toHaveValue('3d6');
  await dialog.getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('3d6 + 2 = 14');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('#shell-current-system')).toHaveText(pkg.system.name);
  const restored = await open(page, 'Usar técnica');
  await expect(restored.getByLabel('Dados do teste')).toHaveValue('3d6');
  await page.keyboard.press('Escape');
  const download = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const character = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(character.techniques[0].rollOptions).toEqual({ checkEnabled: true, checkExpression: '3d6', modifier: '+2', effect: '1d8', increment: '' });
});

test('contratos rejeitam configurações malformadas e caminhos inseguros', async ({ page }) => {
  await page.goto('/');
  const failures = await page.evaluate(async pkg => {
    const { validateSystemPackage } = await import('/js/validation/schemas.js');
    const variants = [
      value => { value.system.entryRolls.power.scale.max = 2000; },
      value => { value.system.entryRolls.power.scale.step = 0; },
      value => { value.system.entryRolls.power.resource.field = '__proto__.bad'; },
      value => { value.system.entryRolls.power.resource.cost = { value: -1 }; },
      value => { value.system.entryRolls.power.resource.mode = 'unknown'; },
      value => { value.system.entryRolls.power.scale.base = { field: 'energy', itemField: 'grade' }; },
      value => { value.system.entryRolls.power.scale.base = { formula: 'missing' }; },
      value => { value.system.entryRolls.skillCheck.check.expression = { value: 'eval(1)' }; },
      value => { value.system.entryRolls.skillCheck.check.modifier.variables.skill.field = 'constructor.x'; },
      value => { value.system.entryRolls.power.resource.matchField = 'rank'; },
      value => { value.layouts[0].tabs[0].sections[0].containers[0].components[3].rollPreset = 'unknown'; },
      value => { value.system.diceTray = 'true'; },
      value => { value.system.characterTemplate.techniques[0].rollOptions = { checkExpression: '101d6' }; },
      value => { value.system.entryRolls.skillCheck.test = value.system.entryRolls.skillCheck.check; },
      value => { value.layouts[0].tabs[0].sections[0].containers[0].components[3].rollConfigFrom = 'skillCheck'; },
      value => { value.system.characterTemplate.techniques[0].rollOptions = { checkEnabled: true, testEnabled: false }; },
      value => { value.system.characterTemplate.techniques[0].rollOptions = { checkExpression: '1d6', testExpression: '1d8' }; },
    ];
    return [validateSystemPackage(pkg).length, ...variants.map(mutate => { const copy = structuredClone(pkg); mutate(copy); return validateSystemPackage(copy).length; })];
  }, fixture);
  expect(failures.shift()).toBe(0);
  failures.forEach(count => expect(count).toBeGreaterThan(0));
});

for (const theme of ['light', 'dark']) test(`terceiro sistema é acessível no celular e desktop em ${theme}`, async ({ page }, testInfo) => {
  await importFixture(page);
  await page.evaluate(async theme => (await import('/js/theme.js')).applyTheme(theme), theme);
  const dialog = await open(page);
  await dialog.getByLabel('Potência', { exact: true }).selectOption('20');
  await expect(page.locator('.toast--visible')).toHaveCount(0, { timeout: 7000 });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Rolar dano / efeito' }).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused();
    await dialog.screenshot({ path: testInfo.outputPath(`generic-rolls-${theme}-${width}.png`) });
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Ativar poder', exact: true })).toBeFocused();
  const technique = await open(page, 'Usar técnica');
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await technique.screenshot({ path: testInfo.outputPath(`generic-test-${theme}-${width}.png`) });
  }
});
