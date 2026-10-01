import { expect, test } from '@playwright/test';

const tabs = ['Identidade', 'Combate', 'Habilidades', 'Magias', 'Inventário', 'Personalidade', 'Proficiências'];

async function openEntry(page, selector) {
  const entry = page.locator(selector).first();
  if (await entry.getAttribute('open') === null) await entry.locator('summary').click();
  return entry;
}

for (const theme of ['light', 'dark']) {
  for (const width of [360, 768, 1280]) {
    test(`comparação visual D&D ${theme} ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await page.locator('#btn-theme-toggle').click();
      }
      await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
      await expect(page.locator('#legacy-dnd-sheet')).toBeVisible();
      await expect(page.locator('#generic-sheet-host')).toBeVisible();
      await page.addStyleTag({ content: '#dice-tray { display: none !important; }' });

      for (const tab of tabs) {
        await page.locator('#generic-sheet-host').getByRole('tab', { name: tab, exact: true }).click();
        await expect(page.locator('#legacy-dnd-sheet [role="tabpanel"]:not([hidden])')).toBeVisible();
        await expect(page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden])')).toBeVisible();
        expect(await page.locator('#generic-sheet-host .engine-component--pending').count()).toBe(0);
        const bounds = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          content: document.documentElement.scrollWidth,
        }));
        expect(bounds.content).toBeLessThanOrEqual(bounds.viewport);
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-${tab.toLowerCase()}.png`), fullPage: true });
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`comparação visual preenchida D&D ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#btn-theme-toggle').click();
    await page.getByRole('button', { name: 'Comparar lado a lado' }).click();
    await page.addStyleTag({ content: '#dice-tray { display: none !important; }' });
    await page.locator('#legacy-dnd-sheet [data-bind="identity.name"]').fill('Lia da Aurora');
    await page.locator('#legacy-dnd-sheet [data-bind="identity.class"]').fill('Guerreira');
    await page.locator('#legacy-dnd-sheet [data-bind="identity.level"]').fill('5');
    await page.locator('#generic-sheet-host .engine-dnd-ability__score').first().fill('16');

    await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Combate' }).click();
    await page.locator('#btn-add-attack').click();
    const attack = await openEntry(page, '#attacks-list .entry-card');
    await attack.locator('[data-field="name"]').fill('Espada longa');
    await attack.locator('[data-field="damage"]').fill('1d8+3');

    await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Habilidades' }).click();
    await page.locator('#btn-add-feature').click();
    const feature = await openEntry(page, '#features-list .entry-card');
    await feature.locator('[data-field="name"]').fill('Estilo de Luta');
    await feature.locator('[data-field="description"]').fill('Uma técnica de combate refinada.');

    await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Magias' }).click();
    await page.locator('#btn-add-spell').click();
    const spell = await openEntry(page, '#spells-list .entry-card');
    await spell.locator('[data-field="name"]').fill('Luz');
    await page.locator('#legacy-dnd-sheet [data-bind="spellcasting.ability"]').selectOption('wis');
    await page.locator('#legacy-dnd-sheet .spell-slot-row').first().locator('[data-el="max"]').fill('2');

    await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Inventário' }).click();
    await page.locator('#btn-add-item').click();
    await page.locator('#inventory-tbody [data-field="name"]').fill('Corda');

    await page.locator('#legacy-dnd-sheet').getByRole('tab', { name: 'Personalidade' }).click();
    await page.locator('#legacy-dnd-sheet [data-bind="personality.traits"]').fill('Corajosa e sempre pronta para proteger os amigos.');

    await page.locator('#generic-sheet-host').getByRole('tab', { name: 'Proficiências' }).click();
    const armorTags = page.locator('#generic-sheet-host [role="tabpanel"]:not([hidden]) .engine-tags').first();
    await armorTags.getByRole('textbox').fill('Armadura leve');
    await armorTags.getByRole('button', { name: 'Adicionar' }).click();

    for (const tab of tabs) {
      await page.locator('#generic-sheet-host').getByRole('tab', { name: tab, exact: true }).click();
      const bounds = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('#view-sheet *')].filter((element) =>
          element.getBoundingClientRect().right > document.documentElement.clientWidth + 1 &&
          element.getBoundingClientRect().width > 0).slice(0, 10).map((element) => ({
            tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right),
          })),
        widths: ['.engine-section--items', '.engine-container--items', '.engine-section--items .engine-component', '.engine-table', '.engine-table__scroll', '.engine-table table'].map((selector) => {
          const element = document.querySelector(selector);
          return { selector, width: Math.round(element?.getBoundingClientRect().width || 0), scrollWidth: element?.scrollWidth || 0 };
        }),
      }));
      expect(bounds.content, `${tab}: ${JSON.stringify(bounds.offenders)} ${JSON.stringify(bounds.widths)}`).toBeLessThanOrEqual(bounds.viewport);
      await page.screenshot({ path: testInfo.outputPath(`filled-${theme}-${tab.toLowerCase()}.png`), fullPage: true });
    }
  });
}
