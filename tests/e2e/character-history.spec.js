import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const host = '#generic-sheet-host';
const undo = '#btn-undo-edit', redo = '#btn-redo-edit';
const errors = new WeakMap();
async function values(page) { return page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get())); }
async function openSystem(page, name) {
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText(name);
}
test.beforeEach(async ({ page }) => {
  errors.set(page, []); page.on('pageerror', error => errors.get(page).push(error.message));
  await page.goto('/');
  await expect(page.locator(host).getByRole('tab', { name: 'Identidade', exact: true })).toBeVisible();
  await expect(page.locator(undo)).toBeDisabled();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

test('digitação agrupada, atalhos, nova ramificação e busca com undo próprio', async ({ page }) => {
  const name = page.locator(host).getByLabel('Nome do personagem', { exact: true });
  const original = await name.inputValue(), id = (await values(page)).meta.id;
  await name.fill(''); await name.pressSequentially('Guardiã', { delay: 30 });
  await expect(page.locator('#edit-history-status')).toContainText('1 operação(ões) para desfazer');
  await name.press('Control+z'); await expect(name).toHaveValue(original); await expect(name).toBeFocused();
  await name.press('Control+Shift+z'); await expect(name).toHaveValue('Guardiã');
  await page.locator(undo).click(); await name.fill('Novo caminho'); await expect(page.locator(redo)).toBeDisabled();
  const count = await page.locator('#edit-history-status').textContent();
  await page.locator('#sheet-search-input').fill('busca independente'); await page.locator('#sheet-search-input').press('Control+z');
  expect(await page.locator('#edit-history-status').textContent()).toBe(count);
  expect((await values(page)).identity.name).toBe('Novo caminho'); expect((await values(page)).meta.id).toBe(id);
});

test('edições estática e modular desfazem em comparação e após trocar layout', async ({ page }) => {
  const input = page.locator(host).getByLabel('PV Atual', { exact: true });
  const original = (await values(page)).combat.hpCurrent;
  await input.fill('17');
  await page.getByRole('button', { name: 'Comparar lado a lado', exact: true }).click();
  await page.locator('[data-bind="combat.hpCurrent"]').fill('12');
  await page.locator(undo).click();
  await expect(input).toHaveValue('17'); await expect(page.locator('[data-bind="combat.hpCurrent"]')).toHaveValue('17');
  await page.locator(redo).click(); await expect(input).toHaveValue('12');
  await page.locator('#sheet-layout-select').selectOption('dnd2024-table');
  await page.locator(undo).click(); await page.locator(undo).click();
  expect((await values(page)).combat.hpCurrent).toBe(original);
  await page.locator(redo).click(); expect((await values(page)).combat.hpCurrent).toBe(17);
});

test('listas conservam conteúdo, IDs e ordem ao adicionar, mover e remover', async ({ page }) => {
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.setPath('features', [{ id: 'a', name: 'Primeira' }, { id: 'b', name: 'Segunda' }]);
    state.moveItem('features', 'b', -1); state.removeItem('features', 'a');
  });
  await page.locator(undo).click(); expect((await values(page)).features.map(item => item.id)).toEqual(['b', 'a']);
  await page.locator(undo).click(); expect((await values(page)).features.map(item => item.id)).toEqual(['a', 'b']);
  await page.locator(redo).click(); await page.locator(redo).click(); expect((await values(page)).features).toEqual([{ id: 'b', name: 'Segunda' }]);
  await page.evaluate(async () => (await import('/js/state.js')).state.addItem('features', { name: 'Terceira' }));
  const entry = (await values(page)).features.at(-1);
  await page.locator(undo).click(); await page.locator(redo).click(); expect((await values(page)).features.at(-1)).toEqual(entry);
});

test('uma marcação estática que altera perícia e especialização é uma única operação', async ({ page }) => {
  await page.getByRole('button', { name: 'Ficha estática', exact: true }).click();
  await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Identidade', exact: true }).click();
  const entry = page.locator('#skills-list [data-skill="acrobatics"]');
  await entry.locator('[data-el="expertise"]').check();
  expect((await values(page)).skills.acrobatics).toMatchObject({ proficient: true, expertise: true });
  await expect(page.locator('#edit-history-status')).toContainText('1 operação(ões) para desfazer');
  await page.locator(undo).click(); expect((await values(page)).skills.acrobatics).toMatchObject({ proficient: false, expertise: false });
  await page.locator(redo).click(); expect((await values(page)).skills.acrobatics).toMatchObject({ proficient: true, expertise: true });
});

test('atalhos não alteram a ficha enquanto o painel tem uma prévia aberta', async ({ page }) => {
  await page.locator(host).getByLabel('PV Atual', { exact: true }).fill('7');
  await page.locator(host).getByRole('button', { name: 'Descanso curto', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Recuperação informada por dado').fill('4');
  await page.keyboard.press('Control+z'); expect((await values(page)).combat.hpCurrent).toBe(7);
  await page.keyboard.press('Escape'); await page.locator(undo).click(); expect((await values(page)).combat.hpCurrent).not.toBe(7);
});

test('limpar ficha é reversível e preserva o personagem', async ({ page }) => {
  await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Antes da limpeza');
  const before = await values(page);
  await page.locator('#btn-clear-character').click(); await page.getByRole('dialog').getByRole('button', { name: 'Limpar', exact: true }).click();
  expect((await values(page)).identity.name).not.toBe('Antes da limpeza');
  await page.locator(undo).click(); const restored = await values(page);
  expect(restored.identity).toEqual(before.identity); expect(restored.meta.id).toBe(before.meta.id);
  await page.locator(redo).click(); expect((await values(page)).identity.name).not.toBe('Antes da limpeza');
});

test('restaurar biblioteca reinicia o histórico; backup não exporta patches', async ({ page }) => {
  await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Antes do backup');
  const backup = await page.evaluate(async () => (await import('/js/library-backup.js')).exportLibrary((await import('/js/state.js')).state.get()));
  expect(JSON.stringify(backup)).not.toContain('undoCount'); expect(backup.characters[0]).not.toHaveProperty('history');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.locator('#input-import-library').setInputFiles({ name: 'history-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(page.locator('.toast').last()).toContainText('Biblioteca restaurada');
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await expect(page.locator(undo)).toBeDisabled(); await expect(page.locator(redo)).toBeDisabled();
  expect((await values(page)).identity.name).toBe('Antes do backup');
});

test('lançar com consumo refaz o saldo e opções sem nova rolagem', async ({ page }) => {
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.setPath('spellcasting.spells', [{ id: 'spell', name: 'Magia com custo', level: 1 }]);
    state.get().spellcasting.slots[0].max = 2; state.get().spellcasting.slots[0].used = 0;
    state.get().spellcasting.consumeSlots = true; state.notify(); Math.random = () => 0.5;
  });
  await page.locator(host).getByRole('tab', { name: 'Magias', exact: true }).click();
  const entry = page.locator(`${host} .engine-entry:visible`).first();
  if (await entry.getAttribute('open') === null) await entry.locator('summary').click();
  await entry.getByRole('button', { name: 'Lançar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lançar', exact: true }).click();
  await page.keyboard.press('Escape'); const after = await values(page);
  expect(after.spellcasting.slots[0].used).toBe(1);
  await page.locator(undo).click(); expect((await values(page)).spellcasting.slots[0].used).toBe(0);
  await page.evaluate(() => { Math.random = () => { throw new Error('Refazer não deve rolar'); }; });
  await page.locator(redo).click(); expect((await values(page)).spellcasting).toEqual(after.spellcasting);
  await expect(page.locator(`${host} .engine-slot__count`).first()).toHaveText('1 / 2');
});

test('ação autoral restaura recursos e registro, inclusive seu desfazer específico', async ({ page }) => {
  await openSystem(page, 'Sistema de RPG'); await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
  const before = await values(page);
  await page.getByRole('button', { name: 'Ganhar RA', exact: true }).click(); const after = await values(page);
  expect(after.resources.actionResource.current).toBe(before.resources.actionResource.current + 1);
  await page.locator(undo).click(); expect((await values(page)).resources).toEqual(before.resources);
  await page.locator(redo).click(); expect((await values(page)).resources).toEqual(after.resources);
  await page.getByRole('button', { name: 'Desfazer última ação', exact: true }).click();
  expect((await values(page)).resources).toEqual(before.resources);
  await page.locator(undo).click(); expect((await values(page)).resources).toEqual(after.resources);
});

test('recuperação é atômica com seu registro; refazer não rola nem recupera duas vezes', async ({ page }) => {
  await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    state.setPath('combat.hpCurrent', 4); state.setPath('combat.hpMax', 30);
    state.setPath('combat.hitDice', { used: 0, total: 4, die: 'd8' });
    Math.random = () => 0.5;
  });
  const before = await values(page);
  await page.locator(host).getByRole('button', { name: 'Descanso curto', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Gastar um dado', exact: true }).click();
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Aplicar recuperação', exact: true }).click();
  await page.keyboard.press('Escape'); const after = await values(page);
  expect(after.combat.hpCurrent).toBeGreaterThan(before.combat.hpCurrent);
  await page.locator(undo).click(); expect((await values(page)).combat).toEqual(before.combat);
  await page.evaluate(() => { Math.random = () => { throw new Error('Refazer não deve rolar'); }; });
  await page.locator(redo).click(); expect((await values(page)).combat).toEqual(after.combat);
  await page.locator(host).getByRole('button', { name: 'Desfazer recuperação', exact: true }).click();
  expect((await values(page)).combat.hpCurrent).toBe(4);
  await page.locator(undo).click(); expect((await values(page)).combat).toEqual(after.combat);
  await page.locator(redo).click(); expect((await values(page)).combat.hpCurrent).toBe(4);
});

test('evolução paga restaura traço e registro sem duplicar custos; edição direta é gratuita', async ({ page }) => {
  await openSystem(page, 'Sistema de RPG');
  await page.getByRole('tab', { name: 'Progressão', exact: true }).click();
  const budget = page.locator('.engine-budget');
  await page.getByLabel('Pontos de evolução recebidos').fill('5');
  await budget.getByRole('button', { name: 'Concluir criação', exact: true }).click();
  await budget.getByLabel('Traço a evoluir').selectOption({ label: 'Atletismo · d4' });
  await budget.getByLabel('Novo dado').selectOption('6');
  await budget.getByLabel('Origem da evolução').selectOption('points');
  await budget.getByLabel('Custo em pontos').fill('2');
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  const after = await values(page);
  await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('2');
  await page.locator(undo).click(); await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('0');
  await page.locator(redo).click(); await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('2');
  expect((await values(page)).progression).toEqual(after.progression);
  await budget.getByRole('button', { name: 'Desfazer última evolução', exact: true }).click();
  await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('0');
  await page.locator(undo).click(); expect((await values(page)).progression).toEqual(after.progression);
  await page.getByRole('tab', { name: 'Perícias', exact: true }).click();
  await page.getByRole('button', { name: 'Editar perícias', exact: true }).click();
  await page.getByLabel('Atletismo', { exact: true }).selectOption('8');
  expect((await values(page)).progression).toEqual(after.progression);
});

test('histórico separado por personagem e reiniciado na recarga', async ({ page }) => {
  const name = page.locator(host).getByLabel('Nome do personagem', { exact: true });
  await name.fill('Primeira pessoa'); const id = (await values(page)).meta.id;
  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await page.locator('#btn-library-new-character').click(); await expect(page.locator(undo)).toBeDisabled();
  await name.fill('Segunda pessoa');
  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await page.locator('#characters-list .library-card').filter({ hasText: 'Primeira pessoa' }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(name).toHaveValue('Primeira pessoa');
  expect((await values(page)).meta.id).toBe(id); await expect(page.locator(undo)).toBeEnabled();
  await page.locator(undo).click(); await page.locator(redo).click(); await expect(name).toHaveValue('Primeira pessoa');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo'); await page.reload();
  await expect(name).toHaveValue('Primeira pessoa'); await expect(page.locator(undo)).toBeDisabled(); await expect(page.locator(redo)).toBeDisabled();
});

test('pacote importado usa o histórico genérico em campos e recuperação', async ({ page }) => {
  const pkg = JSON.parse(readFileSync('data/examples/recovery-actions.package.json', 'utf8'));
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({ name: 'pause.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await page.locator('#systems-list .library-card').filter({ hasText: pkg.system.name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  const before = await values(page), dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Aplicar recuperação', exact: true }).click();
  await page.keyboard.press('Escape'); const after = await values(page);
  expect(after.energy).toBe(8); await page.locator(undo).click(); expect((await values(page)).energy).toBe(before.energy);
  await page.locator(redo).click(); expect((await values(page)).energy).toBe(8);
  await expect(page.getByLabel('Energia', { exact: true })).toHaveValue('8');
});

test('patches preservam ausência/null, chaves literais, metadados e alterações externas', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { CharacterHistory } = await import('/js/character-history.js');
    const character = { meta: { id: 'patch', system: 'test', updatedAt: 'before' }, a: null, b: 1, extra: 'original', calculationOverrides: {} };
    const history = new CharacterHistory(); history.activate(character);
    delete character.a; character.b = 2; character.calculationOverrides['computed.capacity'] = { mode: 'fixed', value: 0 }; history.record(character);
    character.meta.updatedAt = 'later'; character.extra = 'external';
    history.apply(character, 'undo'); const undone = structuredClone(character);
    history.apply(character, 'redo'); const redone = structuredClone(character);
    character.b = 3; let conflict = false; try { history.apply(character, 'undo'); } catch { conflict = true; }
    const conflicted = structuredClone(character), count = history.status().undoCount;
    character.b = 2; let invalid = false; try { history.apply(character, 'undo', () => { throw new Error('inválido'); }); } catch { invalid = true; }
    return { undone, redone, conflict, conflicted, count, invalid, afterInvalid: character };
  });
  expect(result.undone).toEqual({ meta: { id: 'patch', system: 'test', updatedAt: 'later' }, a: null, b: 1, extra: 'external', calculationOverrides: {} });
  expect(result.redone).not.toHaveProperty('a'); expect(result.redone.calculationOverrides['computed.capacity']).toEqual({ mode: 'fixed', value: 0 });
  expect(result.conflict).toBe(true); expect(result.conflicted.b).toBe(3); expect(result.count).toBe(1); expect(result.invalid).toBe(true); expect(result.afterInvalid.b).toBe(2);
});

test('limites de operações, memória e cache não atravessam edição descartada', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { CharacterHistory } = await import('/js/character-history.js');
    const character = { meta: { id: 'limits', system: 'test' }, value: 0 };
    const history = new CharacterHistory(); history.activate(character);
    for (let i = 1; i <= 55; i++) { character.value = i; history.record(character); }
    const count = history.status().undoCount; while (history.apply(character, 'undo')) {} const oldest = character.value;
    const typing = new CharacterHistory(); typing.activate(character);
    character.value = 6; typing.record(character);
    character.value = 7; typing.record(character, { group: 'input' });
    character.value = 6; typing.record(character, { group: 'input' });
    character.value = 8; typing.record(character, { group: 'input' });
    typing.apply(character, 'undo'); const afterNeutralTyping = character.value;
    const limited = new CharacterHistory({ maxBytes: 300, maxCharacters: 2 }); limited.activate(character);
    character.value = 6; limited.record(character); character.value = 'x'.repeat(400); limited.record(character);
    const barrier = limited.status();
    character.value = 7; limited.activate(character); character.value = 8; limited.record(character);
    const cached = limited.status().undoCount;
    limited.activate({ meta: { id: 'two', system: 'test' }, value: 0 });
    limited.activate({ meta: { id: 'three', system: 'test' }, value: 0 }); limited.activate(character);
    return { count, oldest, afterNeutralTyping, barrier, cached, evicted: limited.status().undoCount };
  });
  expect(result.count).toBe(50); expect(result.oldest).toBe(5); expect(result.barrier.undoCount).toBe(0); expect(result.barrier.redoCount).toBe(0); expect(result.cached).toBe(1); expect(result.evicted).toBe(0);
  expect(result.afterNeutralTyping).toBe(6);
});

for (const width of [360, 1280]) for (const theme of ['light', 'dark']) test(`controles discretos e acessíveis: ${width}px ${theme}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async mode => (await import('/js/theme.js')).applyTheme(mode), theme);
  await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Histórico da sessão');
  for (const control of [undo, redo, '#sheet-layout-select']) {
    await expect(page.locator(control)).toBeVisible();
    expect((await page.locator(control).boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`history-${width}-${theme}.png`), fullPage: false });
});
