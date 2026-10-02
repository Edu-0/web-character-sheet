import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.setPath('combat.attacks', [{ id: 'axe', name: 'Machado', bonus: '+5', damage: '1d12 + 3' }]);
    state.setPath('spellcasting.spells', [{ id: 'spell', name: 'Magia de teste', level: 1 }]);
    state.get().spellcasting.slots.forEach(entry => { entry.max = 1; entry.used = 0; });
    state.notify();
    Math.random = () => 0.5;
  });
});

async function open(page, spell = true, host = '#generic-sheet-host') {
  await page.locator(host).getByRole('tab', { name: spell ? 'Magias' : 'Combate', exact: true }).click();
  const entry = page.locator(`${host} ${host.includes('generic') ? '.engine-entry:visible' : '.entry-card:visible'}`).first();
  if (await entry.getAttribute('open') === null) await entry.locator('summary').click();
  await entry.getByRole('button', { name: spell ? 'Lançar' : 'Rolar ataque / ação', exact: true }).click();
  return page.getByRole('dialog');
}

for (const presentation of ['Ficha modular', 'Ficha estática']) test(`espaços compartilhados atualizam nos cards ao lançar duas magias em ${presentation}`, async ({ page }) => {
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.get().spellcasting.slots[0].max = 5;
    state.get().spellcasting.slots[0].used = 2;
    state.get().spellcasting.spells.push({ id: 'other', name: 'Outra magia', level: 1 });
    state.notify();
    (await import('/js/ui.js')).renderAll(state.get());
  });
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  const host = presentation === 'Ficha modular' ? '#generic-sheet-host' : '#legacy-dnd-sheet';
  await page.locator(host).getByRole('tab', { name: 'Magias', exact: true }).click();
  const modular = page.locator('#generic-sheet-host .engine-slot__count').first();
  const legacy = page.locator('#spell-slots [data-el="count"]').first();
  await expect(modular).toHaveText('3 / 5'); await expect(legacy).toHaveText('3 / 5');
  await page.locator(host).getByLabel('Consumir espaço ao lançar magia').check();
  let dialog = await open(page, true, host);
  await expect(dialog.getByLabel('Consumir espaço escolhido')).toHaveCount(0);
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('3 / 5');
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(modular).toHaveText('2 / 5'); await expect(legacy).toHaveText('2 / 5');
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('2 / 5');
  await page.keyboard.press('Escape');
  const second = page.locator(`${host} ${host.includes('generic') ? '.engine-entry:visible' : '.entry-card:visible'}`).nth(1);
  await second.locator('summary').click();
  await second.getByRole('button', { name: 'Lançar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(modular).toHaveText('1 / 5'); await expect(legacy).toHaveText('1 / 5');
  await page.keyboard.press('Escape');
  await page.locator(host).getByLabel('Consumir espaço ao lançar magia').uncheck();
  dialog = await open(page, true, host);
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(modular).toHaveText('1 / 5'); await expect(legacy).toHaveText('1 / 5');
  await page.keyboard.press('Escape'); await page.reload();
  await page.locator(host).getByRole('tab', { name: 'Magias', exact: true }).click();
  await expect(modular).toHaveText('1 / 5'); await expect(legacy).toHaveText('1 / 5');
  await expect(page.locator(host).getByLabel('Consumir espaço ao lançar magia')).not.toBeChecked();
});

test('ataque e dano separados, configuração persistida e sincronizada com a estática', async ({ page }) => {
  let dialog = await open(page, false);
  await expect(dialog.getByLabel('Prévia da rolagem')).toHaveText('Ataque: 1d20 + 5 · Dano/efeito: 1d12 + 3');
  await dialog.getByRole('button', { name: 'Rolar ataque', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('1d20 + 5 = 16');
  await expect(page.locator('#dice-history li')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Rolar dano / efeito' }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('1d12 + 3 = 10');
  await dialog.getByLabel('Dados de dano ou efeito').fill('2d6 - 2');
  await dialog.getByRole('button', { name: 'Salvar configuração' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.source-roll-trigger:visible')).toBeFocused();
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  dialog = await open(page, false, '#legacy-dnd-sheet');
  await expect(dialog.getByLabel('Dados de dano ou efeito')).toHaveValue('2d6 - 2');
  await page.keyboard.press('Escape');
  await expect(page.locator('#legacy-dnd-sheet .source-roll-trigger:visible')).toBeFocused();
  await page.reload();
  dialog = await open(page, false);
  await expect(dialog.getByLabel('Dados de dano ou efeito')).toHaveValue('2d6 - 2');
  await dialog.getByRole('button', { name: 'Rolar dano / efeito' }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused();
});

test('espaço maior altera prévia e dados; consumo opcional e bloqueio sem espaço', async ({ page }) => {
  const dialog = await open(page);
  await dialog.getByLabel('Dados de dano ou efeito').fill('3d6 + 4');
  await dialog.getByLabel('Dados adicionais por nível de espaço').fill('1d6');
  await dialog.getByLabel('Nível do espaço').selectOption('3');
  await expect(dialog.getByLabel('Prévia da rolagem')).toContainText('5d6 + 4');
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('5d6 + 4 = 24');
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('1 / 1');
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('spellcasting.consumeSlots', true));
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('0 / 1');
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Não há espaço disponível');
  await expect(page.locator('#dice-history li')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Rolar dano / efeito' }).click();
  await expect(page.locator('#dice-history li')).toHaveCount(3);
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('0 / 1');
});

test('magia sem dados lança sem histórico, pode consumir espaço, e truque não oferece espaços', async ({ page }) => {
  let dialog = await open(page);
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('spellcasting.consumeSlots', true));
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toHaveText('Magia lançada sem rolagem.');
  await expect(page.locator('#dice-history li')).toHaveCount(0);
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('0 / 1');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('spellcasting.spells.0.level', 0));
  dialog = await open(page);
  await expect(dialog.getByLabel('Nível do espaço')).toHaveCount(0);
  await expect(dialog.getByLabel('Consumir espaço escolhido')).toHaveCount(0);
});

test('ataque mágico usa ajustes ativos; dados inválidos não consomem espaço ou rolam', async ({ page }) => {
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.setPath('spellcasting.ability', 'wis');
    state.setPath('calculationOverrides', { 'dnd.spellAttackBonus': { mode: 'fixed', value: 7 } });
  });
  const dialog = await open(page);
  await dialog.getByLabel('Rolar ataque', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(dialog.locator('.source-roll-result')).toContainText('1d20 + 7 = 18');
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('spellcasting.consumeSlots', true));
  for (const expression of ['alert(1)', '101d6', '-1d6', '1d1', '1d6 +']) {
    await dialog.getByLabel('Dados de dano ou efeito').fill(expression);
    await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
    await expect(dialog.getByRole('alert')).not.toBeEmpty();
    await expect(dialog.locator('.source-roll-resource-status')).toContainText('1 / 1');
    await expect(page.locator('#dice-history li')).toHaveCount(1);
  }
  await dialog.getByLabel('Dados de dano ou efeito').fill('100d6');
  await dialog.getByLabel('Dados adicionais por nível de espaço').fill('1d6');
  await dialog.getByLabel('Nível do espaço').selectOption('2');
  await dialog.getByRole('button', { name: 'Lançar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Limite');
  await expect(dialog.locator('.source-roll-resource-status')).toContainText('1 / 1');
});

test('configuração acompanha exportação/importação do personagem', async ({ page }) => {
  const dialog = await open(page);
  await dialog.getByLabel('Dados de dano ou efeito').fill('3d6 + 4');
  await dialog.getByLabel('Dados adicionais por nível de espaço').fill('1d6');
  await dialog.getByRole('button', { name: 'Salvar configuração' }).click();
  await page.keyboard.press('Escape');
  const download = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const character = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(character.spellcasting.spells[0].rollOptions.effect).toBe('3d6 + 4');
  await page.locator('#input-import-file').setInputFiles({ name: 'personagem.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(character)) });
  await page.reload();
  const restored = await open(page);
  await expect(restored.getByLabel('Dados de dano ou efeito')).toHaveValue('3d6 + 4');
  await expect(restored.getByLabel('Dados adicionais por nível de espaço')).toHaveValue('1d6');
});

test('bandeja aceita grupos de dados e modificador negativo', async ({ page }) => {
  await page.locator('#btn-dice-toggle').click();
  await page.getByLabel('Rolagem personalizada').fill('2d6 + 1d8 - 2');
  await page.getByRole('button', { name: 'Rolar expressão' }).click();
  await expect(page.locator('#dice-result')).toHaveText('2d6 + 1d8 - 2 = 11');
  await page.getByLabel('Rolagem personalizada').fill('NaN');
  await page.getByRole('button', { name: 'Rolar expressão' }).click();
  await expect(page.locator('#dice-expression-error')).not.toBeEmpty();
  await expect(page.locator('#dice-history li')).toHaveCount(1);
});

test('validação rejeita configurações inválidas e mantém contratos do rolador', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const { getSystemPackage } = await import('/js/repositories/system-repository.js');
    const { validateCharacterForPackage, validateLayout } = await import('/js/validation/schemas.js');
    const { state } = await import('/js/state.js');
    const { parseDiceExpression, formatDiceExpression, scaleDiceExpression, evaluateDiceExpression } = await import('/js/engine/dice-expression.js');
    const pkg = await getSystemPackage('dnd2024');
    const character = structuredClone(state.get());
    const failures = [];
    for (const options of [{ attack: 'true' }, { effect: '0d6' }, { upcast: '1d6*2' }, { attackModifier: 2 }, { unknown: true }]) {
      character.spellcasting.spells[0].rollOptions = options;
      failures.push(validateCharacterForPackage(character, pkg).length);
    }
    const component = pkg.layouts[0].tabs.flatMap(tab => tab.sections.flatMap(section => section.containers.flatMap(container => container.components || []))).find(component => component.entryAction);
    component.entryAction = 'unknown';
    failures.push(validateLayout(pkg.layouts[0], { system: pkg.system }).length);
    return {
      failures,
      mixed: formatDiceExpression(scaleDiceExpression(parseDiceExpression('1d8 - 2'), parseDiceExpression('1d6 + 1'), 2)),
      fixed: evaluateDiceExpression(parseDiceExpression('4')).total,
      empty: parseDiceExpression('', { allowEmpty: true }),
    };
  });
  results.failures.forEach(count => expect(count).toBeGreaterThan(0));
  expect(results.mixed).toBe('1d8 + 2d6');
  expect(results.fixed).toBe(4);
  expect(results.empty).toEqual({ dice: [], modifier: 0 });
});

for (const theme of ['light', 'dark']) test(`painel cabe no celular e desktop e prende foco em ${theme}`, async ({ page }, testInfo) => {
  await page.evaluate(async theme => (await import('/js/theme.js')).applyTheme(theme), theme);
  const dialog = await open(page);
  await dialog.getByLabel('Dados de dano ou efeito').fill('3d6 + 4');
  await dialog.getByLabel('Dados adicionais por nível de espaço').fill('1d6');
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Rolar dano / efeito' }).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Rolar dano / efeito' })).toBeFocused();
    await dialog.screenshot({ path: testInfo.outputPath(`source-roll-${theme}-${width}.png`) });
  }
});
