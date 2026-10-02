import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function values(page) { return page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get())); }
async function panel(page, label = 'Descanso curto', host = '#generic-sheet-host') {
  await page.locator(host).getByRole('tab', { name: 'Identidade', exact: true }).click();
  await page.locator(host).getByRole('button', { name: label, exact: true }).click();
  return page.getByRole('dialog');
}
async function apply(dialog) {
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Aplicar recuperação' }).click();
  await expect(dialog.getByLabel('Prévia da recuperação')).toContainText('Recuperação aplicada');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.setPath('combat.hpCurrent', 4); state.setPath('combat.hpMax', 30); state.setPath('combat.hpTemp', 5);
    state.setPath('combat.hitDice', { used: 1, total: 4, die: 'd8' }); state.setPath('abilities.con.score', 14);
    state.setPath('features', [
      { id: 'short', name: 'Recurso curto', usesCurrent: 0, usesMax: 2, recoverOn: 'shortRest' },
      { id: 'long', name: 'Recurso longo', usesCurrent: 1, usesMax: 3, recoverOn: 'longRest' },
      { id: 'manual', name: 'Recurso manual', usesCurrent: 0, usesMax: 4 },
    ]);
    state.get().spellcasting.slots[0].max = 3; state.get().spellcasting.slots[0].used = 2;
    state.notify(); (await import('/js/ui.js')).renderAll(state.get()); Math.random = () => 0.5;
  });
});

test('curto gasta dados um por vez, aceita mesa, aplica só após confirmação e desfaz', async ({ page }) => {
  const dialog = await panel(page);
  await dialog.getByRole('button', { name: 'Gastar um dado' }).click();
  await expect(dialog.getByLabel('Prévia da recuperação')).toContainText('PV: 4 → 11');
  await dialog.getByLabel('Recuperação informada por dado').fill('9');
  await dialog.getByRole('button', { name: 'Gastar um dado' }).click();
  await expect(dialog.getByLabel('Prévia da recuperação')).toContainText('PV: 4 → 20');
  expect((await values(page)).combat.hpCurrent).toBe(4);
  await dialog.getByRole('button', { name: 'Aplicar recuperação' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Confirme');
  await apply(dialog);
  let character = await values(page);
  expect(character.combat.hpCurrent).toBe(20); expect(character.combat.hitDice.used).toBe(3);
  expect(character.combat.hpTemp).toBe(5); expect(character.spellcasting.slots[0].used).toBe(2);
  expect(character.features.map(item => item.usesCurrent)).toEqual([2, 1, 0]);
  await expect(page.getByLabel('PV Atual', { exact: true })).toHaveValue('20');
  await page.keyboard.press('Escape');
  await page.locator('#generic-sheet-host').getByRole('button', { name: 'Desfazer recuperação' }).click();
  character = await values(page);
  expect(character.combat.hpCurrent).toBe(4); expect(character.combat.hitDice.used).toBe(1);
  expect(character.features[0].usesCurrent).toBe(0);
});

for (const host of ['#generic-sheet-host', '#legacy-dnd-sheet']) test(`longo restaura PV, todos os dados, espaços e somente habilidades marcadas em ${host}`, async ({ page }) => {
  await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
  const dialog = await panel(page, 'Descanso longo', host); await apply(dialog);
  const character = await values(page);
  expect(character.combat.hpCurrent).toBe(30); expect(character.combat.hpTemp).toBe(0);
  expect(character.combat.hitDice.used).toBe(0); expect(character.spellcasting.slots[0].used).toBe(0);
  expect(character.features.map(item => item.usesCurrent)).toEqual([2, 3, 0]);
  await expect(page.locator('#generic-sheet-host .engine-slot__count').first()).toHaveText('3 / 3');
  await expect(page.locator('#spell-slots [data-el="count"]').first()).toHaveText('3 / 3');
  await expect(page.locator('#generic-sheet-host').getByLabel('PV Atual', { exact: true })).toHaveValue('30');
  await expect(page.locator('[data-bind="combat.hpCurrent"]')).toHaveValue('30');
  await page.keyboard.press('Escape'); await page.reload();
  await expect(page.locator('#generic-sheet-host').getByLabel('PV Atual', { exact: true })).toHaveValue('30');
  expect((await values(page)).combat.hpCurrent).toBe(30);
  await page.locator(host).getByRole('tab', { name: 'Identidade', exact: true }).click();
  await page.locator(host).getByRole('button', { name: 'Desfazer recuperação' }).click();
  expect((await values(page)).combat.hpCurrent).toBe(4);
  await expect(page.locator('#generic-sheet-host .engine-slot__count').first()).toHaveText('1 / 3');
});

test('cancelar conserva os dados; cura mínima, teto e quantidade de dados são respeitados', async ({ page }) => {
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('calculationOverrides', { 'dnd.ability.con': { mode: 'fixed', value: -20 } }));
  let dialog = await panel(page);
  await dialog.getByRole('button', { name: 'Gastar um dado' }).click();
  await expect(dialog.getByLabel('Prévia da recuperação')).toContainText('PV: 4 → 5');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  expect((await values(page)).combat.hpCurrent).toBe(4);
  dialog = await panel(page);
  await dialog.getByLabel('Recuperação informada por dado').fill('100');
  await dialog.getByRole('button', { name: 'Gastar um dado' }).click();
  await expect(dialog.getByLabel('Prévia da recuperação')).toContainText('PV: 4 → 30');
  await dialog.getByRole('button', { name: 'Gastar um dado' }).click();
  await dialog.getByRole('button', { name: 'Gastar um dado' }).click();
  await expect(dialog.getByRole('button', { name: 'Gastar um dado' })).toBeDisabled();
  await apply(dialog); expect((await values(page)).combat.hitDice.used).toBe(4);
});

test('zero PV e recurso inválido bloqueiam sem alteração; desfazer recusa valores editados depois', async ({ page }) => {
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('combat.hpCurrent', 0));
  let dialog = await panel(page, 'Descanso longo');
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Aplicar recuperação' }).click();
  await expect(dialog.getByRole('alert')).toContainText('pelo menos 1 PV');
  expect((await values(page)).spellcasting.slots[0].used).toBe(2);
  await page.keyboard.press('Escape');
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('combat.hpCurrent', 4));
  dialog = await panel(page, 'Descanso longo'); await apply(dialog); await page.keyboard.press('Escape');
  await page.locator('#generic-sheet-host').getByLabel('PV Atual', { exact: true }).fill('19');
  await page.locator('#generic-sheet-host').getByRole('button', { name: 'Desfazer recuperação' }).click();
  expect((await values(page)).combat.hpCurrent).toBe(19);
  await expect(page.locator('#generic-sheet-host').getByRole('status').filter({ hasText: 'Os recursos mudaram' })).toBeVisible();
});

test('transação rejeita lista inválida e edição externa; validação bloqueia caminhos e tipos', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { recoveryPlan, applyRecovery } = await import('/js/engine/recovery.js');
    const { validateSystemPackage } = await import('/js/validation/schemas.js');
    const { getSystemPackage } = await import('/js/repositories/system-repository.js');
    const { state } = await import('/js/state.js'); const pkg = await getSystemPackage('dnd2024');
    const config = pkg.system.recoveryActions[1], character = structuredClone(state.get());
    const baseline = structuredClone(character); character.combat.hpCurrent = 5;
    let conflict = false; try { applyRecovery({ character, system: pkg.system }, config, [], baseline); } catch { conflict = true; }
    character.spellcasting.slots[0].used = 'bad'; let invalid = false;
    try { recoveryPlan({ character, system: pkg.system }, config); } catch { invalid = true; }
    const variants = [
      value => { value.system.recoveryActions[0].healing.usedField = '__proto__.bad'; },
      value => { value.system.recoveryActions[1].operations[0].type = 'unknown'; },
      value => { value.system.recoveryActions[1].operations[4].filterValues = 'longRest'; },
      value => { value.system.recoveryActions[0].healing.minimum = -1; },
      value => { value.layouts[0].tabs[0].sections.find(section => section.id === 'recovery').containers[0].components[0].historyField = 'combat'; },
      value => { value.layouts[0].tabs[0].sections.find(section => section.id === 'recovery').containers[0].components[0].historyField = 'constructor.bad'; },
    ];
    return { conflict, invalid, hp: character.combat.hpCurrent, validation: variants.map(mutate => { const copy = structuredClone(pkg); mutate(copy); return validateSystemPackage(copy).length; }) };
  });
  expect(result.conflict).toBe(true); expect(result.invalid).toBe(true); expect(result.hp).toBe(5);
  result.validation.forEach(count => expect(count).toBeGreaterThan(0));
});

test('outro sistema configura recuperação com seus campos e sem resolvedor D&D', async ({ page }) => {
  const pkg = JSON.parse(readFileSync('data/examples/recovery-actions.package.json', 'utf8'));
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({ name: 'pause.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await page.locator('#systems-list .library-card').filter({ hasText: pkg.system.name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await page.getByRole('button', { name: 'Pausa', exact: true }).click(); await apply(page.getByRole('dialog'));
  expect((await values(page)).energy).toBe(8);
});

for (const theme of ['light', 'dark']) test(`descansos e profundidade cabem em celular e desktop em ${theme}`, async ({ page }, testInfo) => {
  await page.evaluate(async theme => (await import('/js/theme.js')).applyTheme(theme), theme);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.locator('.toast--visible')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#generic-sheet-host').getByRole('button', { name: 'Desfazer recuperação' })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath(`cards-${theme}-${width}.png`), fullPage: true });
    const dialog = await panel(page);
    await dialog.getByRole('button', { name: 'Aplicar recuperação' }).focus(); await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused();
    await dialog.screenshot({ path: testInfo.outputPath(`recovery-${theme}-${width}.png`) }); await page.keyboard.press('Escape');
  }
});
