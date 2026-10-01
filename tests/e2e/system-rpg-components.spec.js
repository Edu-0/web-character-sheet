import { expect, test } from '@playwright/test';

const errorsByPage = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('.engine-sheet')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});

test('todos os tipos usados pelo sistema-rpg estão registrados', async ({ page }) => {
  await expect(page.locator('.engine-component--pending')).toHaveCount(0);
  await expect(page.locator('.engine-entry')).toHaveCount(3);
  await expect(page.locator('.engine-table')).toHaveCount(2);
  await expect(page.locator('.engine-pool')).toHaveCount(1);
  const registeredTypes = await page.evaluate(async () => {
    const { hasFieldType } = await import('/js/engine/fields.js');
    return ['list', 'table', 'tagList', 'computed', 'slotTracker', 'poolBuilder', 'stateList', 'image']
      .filter((type) => hasFieldType(type));
  });
  expect(registeredTypes).toEqual(['list', 'table', 'tagList', 'computed', 'slotTracker', 'poolBuilder', 'stateList', 'image']);
});

test('tags podem ser adicionadas e removidas', async ({ page }) => {
  await page.getByRole('tab', { name: 'Progressão' }).click();
  const buffs = page.locator('.engine-tags').filter({ has: page.getByRole('heading', { name: 'Buffs', exact: true }) });
  await buffs.getByPlaceholder('Adicionar…').fill('Inspirado');
  await buffs.getByRole('button', { name: 'Adicionar' }).click();
  await expect(buffs.locator('.tag-chip')).toHaveText('Inspirado×');
  await buffs.getByRole('button', { name: 'Remover Inspirado' }).click();
  await expect(buffs.locator('.tag-chip')).toHaveCount(0);
});

test('listas editáveis adicionam, persistem e removem especializações', async ({ page }) => {
  await page.getByRole('tab', { name: 'Especializações' }).click();
  const panel = page.locator('.engine-panel:not([hidden])');
  await panel.getByRole('button', { name: 'Adicionar' }).click();
  const entry = panel.locator('.engine-entry').first();
  await entry.getByLabel('Nome').fill('Caminho das Estrelas');
  await entry.getByLabel('Dado').selectOption('8');
  await entry.getByLabel('Técnicas relacionadas').fill('tech-a, tech-b');
  await expect(entry.locator('.engine-entry__title')).toHaveText('Caminho das Estrelas');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Especializações' })).toHaveAttribute('aria-selected', 'true');
  const restored = page.locator('.engine-panel:not([hidden]) .engine-entry').first();
  await expect(restored.getByLabel('Nome')).toHaveValue('Caminho das Estrelas');
  await expect(restored.getByLabel('Dado')).toHaveValue('8');
  await restored.getByRole('button', { name: 'Remover' }).click();
  await expect(page.locator('.engine-panel:not([hidden]) .engine-entry')).toHaveCount(0);
});

test('essências preservam o tamanho fixo definido pelo sistema', async ({ page }) => {
  await page.getByRole('tab', { name: 'Essências' }).click();
  const panel = page.locator('.engine-panel:not([hidden])');
  await expect(panel.locator('.engine-entry')).toHaveCount(3);
  await expect(panel.getByRole('button', { name: 'Adicionar' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Remover' })).toHaveCount(0);
});

test('tabelas adicionam e persistem itens de inventário', async ({ page }) => {
  await page.getByRole('tab', { name: 'Inventário' }).click();
  const panel = page.locator('.engine-panel:not([hidden])');
  await panel.getByRole('button', { name: 'Adicionar item' }).click();
  const row = panel.locator('tbody tr').first();
  await row.getByLabel('Nome').fill('Lâmina sem nome');
  await row.getByLabel('Tipo').selectOption('Arma');
  await row.getByLabel('Quantidade').fill('2');
  await row.getByLabel('Descrição').fill('Uma descrição longa para comprovar que a tabela aceita conteúdo variável sem quebrar o layout.');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');

  await page.reload();
  const restored = page.locator('.engine-panel:not([hidden]) tbody tr').first();
  await expect(restored.getByLabel('Nome')).toHaveValue('Lâmina sem nome');
  await expect(restored.getByLabel('Tipo')).toHaveValue('Arma');
  await restored.getByRole('button', { name: 'Remover' }).click();
  await expect(page.locator('.engine-panel:not([hidden]) tbody tr')).toHaveCount(0);
});

test('estados graduados permanecem editáveis', async ({ page }) => {
  await page.getByRole('tab', { name: 'Estados' }).click();
  const trauma = page.locator('.engine-section').filter({ hasText: 'Trauma' });
  await trauma.getByRole('button', { name: 'Adicionar' }).click();
  const entry = trauma.locator('.engine-entry').first();
  await entry.getByLabel('Nome').fill('Assombrado');
  await entry.getByLabel('Dado', { exact: true }).selectOption('10');
  await expect(entry.locator('.engine-entry__meta')).toHaveText('d10');
  await entry.getByLabel('Dado do efeito').selectOption('10');
  await entry.getByRole('button', { name: 'Aplicar efeito' }).click();
  await expect(entry.locator('.engine-entry__meta')).toHaveText('d12');
  await expect(entry.getByLabel('Dado', { exact: true })).toHaveValue('12');
  await expect(entry.locator('.engine-state-effect__feedback')).toContainText('aprimorado para d12');
});

test('computed recalcula e iniciativa pode ser rolada', async ({ page }) => {
  await page.getByRole('tab', { name: 'Combate' }).click();
  const panel = page.locator('.engine-panel:not([hidden])');
  const carry = panel.locator('.engine-computed').filter({ hasText: 'Carga Máxima' });
  await expect(carry.locator('output')).toHaveText('30');

  await page.getByRole('tab', { name: 'Atributos' }).click();
  await page.locator('.engine-panel:not([hidden]) label.field').filter({ hasText: /^Força/ }).locator('select').selectOption('10');
  await page.getByRole('tab', { name: 'Combate' }).click();
  await expect(carry.locator('output')).toHaveText('50');

  const initiative = panel.locator('.engine-computed').filter({ hasText: 'Iniciativa' });
  await initiative.getByRole('button', { name: 'Rolar iniciativa' }).click();
  await expect(initiative.locator('output')).not.toHaveText('—');
});

test('poolBuilder monta Pool e resolve oposição manual', async ({ page }, testInfo) => {
  await page.getByRole('tab', { name: 'Combate' }).click();
  const pool = page.locator('.engine-pool');
  await pool.getByText('Força (Atributo)', { exact: true }).click();
  await pool.getByText('Dado de Existência', { exact: true }).click();
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await expect(pool.locator('.engine-roll')).toHaveCount(2);
  await expect(pool.locator('.engine-pool__summary')).toContainText('Peso');

  await pool.getByLabel('Peso manual', { exact: true }).fill('8');
  await pool.getByRole('button', { name: 'Resolver ação' }).click();
  await expect(pool.locator('.engine-outcome')).toBeVisible();
  await expect(pool.locator('.engine-pool__resolution')).toContainText('Dificuldade');
  await page.screenshot({ path: testInfo.outputPath('pool-builder.png'), fullPage: false });
});

test('Pool reconhece Traços criados durante a edição', async ({ page }) => {
  await page.getByRole('tab', { name: 'Especializações' }).click();
  const panel = page.locator('.engine-panel:not([hidden])');
  await panel.getByRole('button', { name: 'Adicionar' }).click();
  const entry = panel.locator('.engine-entry').first();
  await entry.getByLabel('Nome').fill('Caminho das Estrelas');
  await entry.getByLabel('Dado').selectOption('8');

  await page.getByRole('tab', { name: 'Combate' }).click();
  await expect(page.locator('.engine-pool__trait').filter({ hasText: 'Caminho das Estrelas (Especialização)' })).toBeVisible();
});

test('sucesso crítico apresenta o dado de Potência aprimorado', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0.999; });
  await page.getByRole('tab', { name: 'Combate' }).click();
  const pool = page.locator('.engine-pool');
  await pool.getByText('Força (Atributo)', { exact: true }).click();
  await pool.getByText('Dado de Existência', { exact: true }).click();
  await pool.getByRole('button', { name: 'Rolar Pool' }).click();
  await pool.getByLabel('Peso manual', { exact: true }).fill('0');
  await pool.getByRole('button', { name: 'Resolver ação' }).click();
  await expect(pool.locator('.engine-outcome')).toHaveText('Sucesso crítico');
  await expect(pool.locator('.engine-pool__resolution')).toContainText('Potência aprimorada: d4 → d6');
});

test('tabela vira cartões no celular sem overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole('tab', { name: 'Inventário' }).click();
  const panel = page.locator('.engine-panel:not([hidden])');
  await panel.getByRole('button', { name: 'Adicionar item' }).click();
  await panel.locator('tbody tr').first().getByLabel('Nome').fill('NomeExtremamenteLongoSemEspacosQueNaoPodeEstourarAPagina');
  const dimensions = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  expect(dimensions[1]).toBeLessThanOrEqual(dimensions[0]);
  await page.screenshot({ path: testInfo.outputPath('inventory-mobile.png'), fullPage: false });
});
