import { expect, test } from '@playwright/test';

const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', (error) => errors.get(page).push(error.message));
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('.engine-sheet')).toBeVisible();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function seed(page, changes) {
  await page.evaluate(async (patch) => {
    const repo = await import('/js/repositories/character-repository.js');
    const summary = repo.listCharacters().find((entry) => entry.system === 'sistema-rpg');
    repo.saveCharacter(Object.assign(repo.getCharacter(summary.id), patch));
  }, changes);
  await page.reload();
  await expect(page.locator('.engine-sheet')).toBeVisible();
}
async function stored(page) {
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  return page.evaluate(async () => {
    const repo = await import('/js/repositories/character-repository.js');
    return repo.getCharacter(repo.listCharacters().find((entry) => entry.system === 'sistema-rpg').id);
  });
}
const active = (page) => page.locator('.engine-panel:not([hidden])');

test('carga considera quantidade, itens carregados, multiplicador e Força composta', async ({ page }) => {
  await seed(page, { inventory: [{ id: 'item', name: 'Mochila', weight: 20, quantity: 2, carried: true, die: 6 }] });
  await page.getByRole('tab', { name: 'Inventário' }).click();
  await expect(page.getByLabel('Peso carregado', { exact: true })).toHaveText('40 kg carregados');
  await expect(page.getByLabel('Capacidade de carga', { exact: true })).toHaveText('30 kg de capacidade');
  await expect(active(page)).toContainText('Sobrecarga de 10 kg');
  await active(page).getByLabel('Carregado', { exact: true }).uncheck();
  await expect(page.getByLabel('Peso carregado', { exact: true })).toHaveText('0 kg carregados');
  await active(page).getByLabel('Carregado', { exact: true }).check();
  await page.getByRole('tab', { name: 'Atributos' }).click();
  await page.getByLabel('Força', { exact: true }).selectOption('composite');
  await page.getByLabel('Composição de Força', { exact: true }).fill('d12 + d6');
  await page.getByRole('tab', { name: 'Combate' }).click();
  await page.getByLabel('Multiplicador de carga').fill('8');
  await expect(active(page).locator('.engine-computed').filter({ hasText: 'Carga Máxima' }).locator('.engine-computed__value')).toHaveText('144');
  await page.getByRole('tab', { name: 'Inventário' }).click();
  await expect(page.getByLabel('Capacidade de carga', { exact: true })).toHaveText('144 kg de capacidade');
  await page.reload();
  await expect(page.getByLabel('Peso carregado', { exact: true })).toHaveText('40 kg carregados');
});

test('multiplicador ausente usa 5 sem substituir escolhas personalizadas', async ({ page }) => {
  await seed(page, { carryMultiplier: null });
  await page.getByRole('tab', { name: 'Combate' }).click();
  await expect(page.getByLabel('Multiplicador de carga')).toHaveValue('5');
  const carry = active(page).locator('.engine-computed').filter({ hasText: 'Carga Máxima' }).locator('.engine-computed__value');
  await expect(carry).toHaveText('30');
  await page.getByLabel('Multiplicador de carga').fill('8');
  await expect(carry).toHaveText('48');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect(page.getByLabel('Multiplicador de carga')).toHaveValue('8');
});

test('d4 não graduado pode ser selecionado e todos os dados mostram tamanho e função', async ({ page }) => {
  await page.getByRole('tab', { name: 'Combate' }).click();
  const pool = page.locator('.engine-pool');
  await expect(pool.getByRole('checkbox', { name: /Perícia não graduada/ })).toBeVisible();
  await pool.getByRole('checkbox', { name: /Perícia não graduada/ }).check();
  await page.evaluate(() => { Math.random = () => 0.999; });
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await expect(pool.locator('.engine-roll__die')).toHaveText('d4 · Ápice e Base');
  await expect(pool.locator('.engine-pool__summary')).toHaveText('Peso 4');
  await pool.getByText('Força (Atributo)', { exact: true }).click();
  await pool.getByText('Dado de Existência', { exact: true }).click();
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await expect(pool.locator('.engine-roll__die')).toHaveText(['d4 · Base', 'd6 · Potência disponível', 'd8 · Ápice']);
  await page.getByRole('tab', { name: 'Atributos' }).click();
  await page.getByLabel('Força', { exact: true }).selectOption('composite');
  await page.getByLabel('Composição de Força').fill('d12 + d6');
  await page.getByRole('tab', { name: 'Combate' }).click();
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await expect(pool.locator('.engine-roll__die')).toHaveText(['d4 · Base', 'd12 + d6 · Ápice', 'd8 · Potência disponível']);
});

test('descanso respeita recuperação, preserva ferimentos e permite desfazer; rodada recupera Reação', async ({ page }) => {
  await seed(page, {
    specializations: [{ id: 'spec', name: 'Magia', die: 6 }],
    resources: { energy: { current: 1, max: 12 }, actionResource: { current: 0 } },
    states: { wear: [{ id: 'exausto', name: 'Exausto', sides: 8 }, { id: 'ferido', name: 'Ferido', sides: 10 }, { id: 'permanente', name: 'Exausto', sides: 6, recoverable: false }], trauma: [{ id: 'trauma', name: 'Ferido', sides: 8 }], characteristics: [], complications: [] },
    reaction: { available: false },
  });
  await page.evaluate(() => { Math.random = () => 0.999; });
  await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
  await page.getByRole('button', { name: 'Descanso curto', exact: true }).click();
  let character = await stored(page);
  expect(character.resources.energy.current).toBe(7);
  expect(character.states.wear.map((item) => item.sides)).toEqual([6, 10, 6]);
  expect(character.states.trauma[0].sides).toBe(8);
  await page.getByRole('button', { name: 'Desfazer última ação' }).click();
  character = await stored(page);
  expect(character.resources.energy.current).toBe(1);
  expect(character.states.wear[0].sides).toBe(8);
  await page.getByRole('button', { name: 'Descanso longo', exact: true }).click();
  character = await stored(page);
  expect(character.resources.energy.current).toBe(12);
  expect(character.states.wear.map((item) => item.id)).toEqual(['ferido', 'permanente']);
  await page.getByRole('button', { name: 'Nova rodada' }).click();
  await expect(active(page).getByLabel('Reação Disponível')).toBeChecked();
  await page.getByRole('button', { name: 'Gastar Reação' }).click();
  await expect(active(page).getByLabel('Reação Disponível')).not.toBeChecked();
  await page.getByRole('button', { name: 'Gastar Reação' }).click();
  await expect(page.getByRole('status', { name: 'Resultado da ação' })).toContainText('já foi usada');
  await page.getByRole('button', { name: 'Gastar RA', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Resultado da ação' })).toContainText('Não há RA');
  await page.getByRole('button', { name: 'Ganhar RA', exact: true }).click();
  await page.getByRole('button', { name: 'Gastar RA', exact: true }).click();
  expect((await stored(page)).resources.actionResource.current).toBe(0);
});

test('limite de Desgaste gera Trauma, sinaliza retirada e morte; cura depende do resultado', async ({ page }) => {
  await seed(page, { states: { wear: [{ id: 'ferido', name: 'Ferido', sides: 12 }], trauma: [], characteristics: [{ id: 'caracteristica', name: 'Cicatriz', sides: 6, permanent: true }], complications: [] } });
  await page.getByRole('tab', { name: 'Estados' }).click();
  const wear = active(page).locator('.engine-section').filter({ has: page.getByRole('heading', { name: 'Desgaste', exact: true }) });
  await wear.getByLabel('Dado do efeito').selectOption('12');
  for (const grade of [6, 8, 10, 12]) {
    await wear.getByRole('button', { name: 'Aplicar efeito', exact: true }).click();
    expect((await stored(page)).states.trauma[0].sides).toBe(grade);
  }
  await expect(page.getByLabel('Retirado de cena')).toBeChecked();
  await wear.getByRole('button', { name: 'Aplicar efeito', exact: true }).click();
  await expect(page.getByLabel('Limite letal atingido')).toBeChecked();
  await expect(wear).toContainText('regra indica morte');
  await wear.getByLabel('Resultado da cura').selectOption('failure');
  await wear.getByRole('button', { name: 'Aplicar cura' }).click();
  await expect(wear.getByLabel('Dado', { exact: true })).toHaveValue('12');
  await wear.getByLabel('Resultado da cura').selectOption('success');
  await wear.getByLabel('Potência da cura').selectOption('12');
  await wear.getByRole('button', { name: 'Aplicar cura' }).click();
  await expect(wear.getByLabel('Dado', { exact: true })).toHaveValue('10');
  await wear.getByLabel('Limitar a uma Redução (descanso curto)').check();
  await wear.getByRole('button', { name: 'Aplicar cura' }).click();
  await expect(wear.getByLabel('Dado', { exact: true })).toHaveValue('8');
  await wear.getByLabel('Limitar a uma Redução (descanso curto)').uncheck();
  await wear.getByRole('button', { name: 'Aplicar cura' }).click();
  await expect(wear.locator('.engine-entry')).toHaveCount(0);
  const character = await stored(page);
  expect(character.states.trauma).toHaveLength(1);
  expect(character.states.characteristics[0].permanent).toBe(true);
});

test('técnicas usam Energia pelo dado escolhido, mantêm concentração e protegem saldo insuficiente', async ({ page }, testInfo) => {
  await seed(page, { specializations: [{ id: 'spec', name: 'Gelo', die: 8 }], techniques: [{ id: 'tech', name: 'Barreira', maxDie: 10, currentDie: 10, specializationId: 'spec', energyCost: null, concentration: true }], resources: { energy: { current: 10, max: 10 }, actionResource: { current: 0 } } });
  await page.evaluate(() => { Math.random = () => 0.999; });
  await page.getByRole('tab', { name: 'Técnicas', exact: true }).click();
  const use = page.locator('.engine-technique-use');
  await use.getByLabel('Técnica a utilizar').selectOption('tech');
  await use.getByLabel('Dado escolhido para uso').selectOption('8');
  await use.getByRole('button', { name: 'Usar e rolar' }).click();
  await expect(use).toContainText('4 Energia paga');
  await expect(use.locator('.engine-roll')).toHaveCount(3);
  expect((await stored(page)).resources.energy.current).toBe(6);
  await use.getByLabel('Peso manual do uso').fill('0');
  await use.getByRole('button', { name: 'Resolver uso' }).click();
  await use.getByLabel('Modo de uso').selectOption('maintenance');
  await use.getByRole('button', { name: 'Usar e rolar' }).click();
  await expect(use).toContainText('0 Energia paga');
  expect((await stored(page)).scene.concentrations).toEqual([{ techniqueId: 'tech', die: 8 }]);
  await use.getByLabel('Modo de uso').selectOption('trained');
  await use.getByLabel('Dado escolhido para uso').selectOption('10');
  await use.getByRole('button', { name: 'Usar e rolar' }).click();
  await expect(use).toContainText('Energia insuficiente');
  expect((await stored(page)).resources.energy.current).toBe(6);
  await use.getByLabel('Modo de uso').selectOption('moderate');
  await use.getByLabel('Técnica a utilizar').selectOption('');
  await use.getByLabel('Dado original (técnica não aprendida)').selectOption('8');
  await use.getByRole('button', { name: 'Usar e rolar' }).click();
  await expect(use).toContainText('4 Energia paga');
  await expect(use.locator('.engine-roll').last().locator('strong')).toHaveText('4');
  expect((await stored(page)).resources.energy.current).toBe(2);
  await use.getByLabel('Peso manual do uso').fill('100');
  await use.getByRole('button', { name: 'Resolver uso' }).click();
  await expect(use.locator('.engine-pool__resolution')).toContainText('Reverso');
  await expect(use.getByRole('button', { name: 'Resolver uso' })).toBeDisabled();
  await use.getByLabel('Modo de uso').selectOption('knowledge');
  await use.getByRole('button', { name: 'Usar e rolar' }).click();
  await expect(use).toContainText('0 Energia paga');
  await use.getByLabel('Modo de uso').selectOption('high');
  await use.getByLabel('Dado original (técnica não aprendida)').selectOption('6');
  await use.getByRole('button', { name: 'Usar e rolar' }).click();
  await expect(use.locator('.engine-roll')).toHaveCount(2);
  await use.getByLabel('Peso manual do uso').fill('100');
  await use.getByRole('button', { name: 'Resolver uso' }).click();
  await expect(use.locator('.engine-pool__resolution')).toContainText('Impacto contra o personagem: d6');
  await page.setViewportSize({ width: 360, height: 950 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('techniques-mobile.png'), fullPage: true });
});

test('Pool composta é uma única fonte; apoio temporário fica separado e Pool de um dado usa Peso único', async ({ page }) => {
  await page.getByRole('tab', { name: 'Atributos' }).click();
  await page.getByLabel('Força', { exact: true }).selectOption('composite');
  await page.getByLabel('Composição de Força').fill('d12 + d6');
  await page.getByRole('tab', { name: 'Combate' }).click();
  await page.evaluate(() => { Math.random = () => 0.999; });
  const pool = page.locator('.engine-pool');
  await pool.getByText('Força (Atributo)', { exact: true }).click();
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await expect(pool.locator('.engine-roll')).toHaveCount(1);
  await expect(pool.locator('.engine-pool__summary')).toHaveText('Peso 18');
  await pool.getByLabel('Dados de apoio / ajustes temporários').fill('d4, d6');
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await expect(pool.locator('.engine-roll')).toHaveCount(3);
  await expect(pool.locator('.engine-pool__summary')).toHaveText('Peso 22');
  await pool.getByLabel('Dados de apoio / ajustes temporários').fill('d14');
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await expect(pool).toContainText('Dados de apoio inválidos');
  await pool.getByLabel('Dados de apoio / ajustes temporários').fill('');
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await pool.getByLabel('Dados da oposição (opcional)').fill('d8, d8, d6');
  await pool.getByRole('button', { name: 'Resolver ação' }).click();
  await expect(pool.locator('.engine-pool__resolution')).toContainText('Oposição: 8, 8, 6 · Peso 14');
});

test('Ascensão narrativa e evolução composta opcional mantêm orçamento inicial congelado', async ({ page }) => {
  await page.getByRole('tab', { name: 'Progressão' }).click();
  const budget = page.locator('.engine-budget');
  await page.getByLabel('Pontos de evolução recebidos').fill('100');
  await page.getByLabel('Custos opcionais após Ascensão').check();
  await budget.getByRole('button', { name: 'Concluir criação' }).click();
  await budget.getByLabel('Traço a evoluir').selectOption({ label: 'Força · d6' });
  await budget.getByLabel('Novo dado').selectOption('12');
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  await budget.getByLabel('Novo dado').selectOption('composite');
  await budget.getByLabel('Novo traço composto').fill('d12 + d6');
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  await budget.getByLabel('Novo traço composto').fill('d12 + d8');
  await budget.getByLabel('Origem da evolução').selectOption('points');
  await expect(budget.getByLabel('Custo em pontos')).toHaveValue('24');
  await budget.getByRole('button', { name: 'Registrar evolução', exact: true }).click();
  await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('24');
  await expect(budget.getByLabel('Gastos na criação', { exact: true })).toHaveText('0');
  await budget.getByLabel('Novo traço composto').fill('d12 + d10');
  await expect(budget.getByLabel('Custo em pontos')).toHaveValue('32');
  await budget.getByRole('button', { name: 'Desfazer última evolução' }).click();
  expect((await stored(page)).attributes.strength).toEqual({ dice: [{ sides: 12 }, { sides: 6 }] });
  await expect(budget.getByLabel('Gastos na evolução', { exact: true })).toHaveText('0');
});

test('repertório é mínimo configurado, distingue aprendizado extra e não impõe teto', async ({ page }) => {
  await seed(page, { specializations: [{ id: 'spec', name: 'Gelo', die: 8 }], techniques: [{ id: 'tech', name: 'Barreira', maxDie: 8, specializationId: 'spec', learningSource: 'repertoire' }, { id: 'extra', name: 'Aprendida em cena', maxDie: 12, specializationId: 'spec', learningSource: 'narrative' }] });
  await page.getByRole('tab', { name: 'Técnicas', exact: true }).click();
  const repertoire = page.locator('.engine-repertoire');
  await expect(repertoire).toContainText('Mínimo garantido: 4');
  await expect(repertoire).toContainText('Opções ainda disponíveis: d6, d6, d8');
  await expect(repertoire).not.toContainText('excedem');
});

test('operações genéricas são transacionais e desfazer não sobrescreve ajustes posteriores', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { executeSheetAction, undoSheetAction } = await import('/js/engine/assistance.js');
    const { applyEffectToGradedState } = await import('/js/engine/graded-state.js');
    const character = { stamina: { current: 2, max: 9 }, conditions: [{ name: 'Cansado', grade: 8 }] };
    const system = { dieScale: [4, 8, 12] };
    const event = executeSheetAction(character, { id: 'recover', label: 'Recuperar', effects: [{ type: 'restoreResource', field: 'stamina' }, { type: 'reduceNamedStates', field: 'conditions', name: 'Cansado', gradeField: 'grade' }] }, system);
    const recovered = structuredClone(character);
    character.stamina.current = 5;
    const refused = undoSheetAction(character, event);
    const before = JSON.stringify(character);
    let rejected = false;
    try { executeSheetAction(character, { effects: [{ type: 'add', field: 'stamina.current', amount: 1 }, { type: 'unsupported', field: 'conditions' }] }, system); } catch { rejected = true; }
    return { recovered, refused, rejected, unchanged: before === JSON.stringify(character), graded: applyEffectToGradedState(4, 4, system.dieScale).sides };
  });
  expect(result.recovered).toEqual({ stamina: { current: 9, max: 9 }, conditions: [{ name: 'Cansado', grade: 4 }] });
  expect(result).toMatchObject({ refused: false, rejected: true, unchanged: true, graded: 8 });
});

for (const theme of ['light', 'dark']) {
  test(`todas as abas permanecem responsivas no tema ${theme}`, async ({ page }, testInfo) => {
    await seed(page, { states: { wear: [{ id: 'w', name: 'Ferido', sides: 8 }], trauma: [], complications: [], characteristics: [] }, specializations: [{ id: 's', name: 'Especialização de teste', die: 8 }], inventory: [{ id: 'i', name: 'Equipamento', die: 6, weight: 2, quantity: 1 }] });
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#btn-theme-toggle').click();
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 950 });
      for (const tab of await page.locator('.engine-tabs [role="tab"]').all()) {
        await tab.click();
        const tabName = await tab.textContent();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), { message: `${theme} ${width}px: ${tabName}` }).toBe(true);
      }
      await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(`resources-${theme}-${width}.png`), fullPage: true });
    }
  });
}

test('itens e artefatos recuperam apenas usos marcados, com editor recolhido e desfazer', async ({ page }, testInfo) => {
  await seed(page, { inventory: [
    { id: 'artifact', name: 'Artefato da mesa', weight: 1, quantity: 1, carried: true, usesCurrent: 0, usesMax: 3 },
    { id: 'long', name: 'Item longo', usesCurrent: 1, usesMax: 4, recoverOn: 'longRest' },
    { id: 'manual', name: 'Item manual', usesCurrent: 0, usesMax: 5 },
  ] });
  await page.getByRole('tab', { name: 'Inventário', exact: true }).click();
  const row = active(page).locator('.engine-table__details-row').first();
  await expect(row.getByLabel('Usos atuais', { exact: true })).not.toBeVisible();
  await row.locator('summary').click();
  await row.getByRole('checkbox', { name: 'Descanso curto ou longo', exact: true }).check();
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => document.documentElement.dataset.theme = mode, mode);
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`item-recovery-${mode}-${width}.png`), fullPage: true });
    }
  }
  await row.locator('summary').click();
  await page.locator('#sheet-search-input').fill('Artefato da mesa usos atuais');
  await page.locator('#sheet-search-list button').filter({ has: page.locator('.sheet-search__name', { hasText: /^Artefato da mesa · Usos atuais$/ }) }).first().click();
  await expect(page.locator('.search-target')).toBeVisible();
  await expect(page.locator('.search-target input')).toHaveValue('0');
  await page.locator('#sheet-search-input').fill('');
  await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
  await page.getByRole('button', { name: 'Descanso curto', exact: true }).click();
  expect((await stored(page)).inventory.map(item => item.usesCurrent)).toEqual([3, 1, 0]);
  await page.getByRole('tab', { name: 'Equipamentos', exact: true }).click();
  await active(page).locator('.engine-table__details-row').first().locator('summary').click();
  await expect(active(page).getByLabel('Usos atuais', { exact: true }).first()).toHaveValue('3');
  await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
  await page.getByRole('button', { name: 'Desfazer última ação', exact: true }).click();
  expect((await stored(page)).inventory.map(item => item.usesCurrent)).toEqual([0, 1, 0]);
  await page.getByRole('button', { name: 'Descanso longo', exact: true }).click();
  expect((await stored(page)).inventory.map(item => item.usesCurrent)).toEqual([3, 4, 0]);
  await page.reload(); await expect(page.locator('.engine-sheet')).toBeVisible();
  expect((await stored(page)).inventory[0].recoverOn).toBe('shortRest');
  await page.getByRole('tab', { name: 'Recursos', exact: true }).click();
  await page.getByRole('button', { name: 'Desfazer última ação', exact: true }).click();
  expect((await stored(page)).inventory.map(item => item.usesCurrent)).toEqual([0, 1, 0]);
});

test('usos inválidos em item marcado bloqueiam descanso sem alterar energia ou estados', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { executeSheetAction } = await import('/js/engine/assistance.js');
    const { getSystemPackage } = await import('/js/repositories/system-repository.js');
    const pkg = await getSystemPackage('sistema-rpg');
    const character = structuredClone(pkg.system.characterTemplate);
    character.inventory = [{ usesCurrent: 0, usesMax: -1, recoverOn: 'shortRest' }];
    const before = JSON.stringify(character); let blocked = false;
    try { executeSheetAction(character, pkg.system.sheetActions.find(action => action.id === 'short-rest'), pkg.system); } catch { blocked = true; }
    const copy = structuredClone(pkg); copy.system.sheetActions[0].operations[0].filterField = '__proto__.bad';
    const { validateSystemPackage } = await import('/js/validation/schemas.js');
    return { blocked, preserved: before === JSON.stringify(character), invalid: validateSystemPackage(copy).length };
  });
  expect(result.blocked).toBe(true); expect(result.preserved).toBe(true); expect(result.invalid).toBeGreaterThan(0);
});
