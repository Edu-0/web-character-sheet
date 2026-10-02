import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startStaticServer } from './static-server.mjs';
import { populate } from './design-fixtures.mjs';

const phase = process.argv[2] || 'after';
const dir = `output/design/${phase}`;
await mkdir(dir, { recursive: true });
const server = await startStaticServer(4175);
const browser = await chromium.launch({ channel: 'msedge' });
const report = { phase, browser: browser.version(), samples: [], errors: [] };
try {
  const page = await browser.newPage();
  const screenshot = async options => { await page.waitForFunction(() => !document.querySelector('.toast--visible'), null, { timeout: 6000 }); await page.screenshot({ ...options, animations: 'disabled' }); };
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4175');
  await page.locator('#shell-current-system').filter({ hasText: 'D&D' }).waitFor();
  for (const id of ['dnd2024', 'sistema-rpg']) {
    if (id !== 'dnd2024') {
      await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
      await page.locator('#systems-list .library-card').filter({ hasText: 'Sistema de RPG' }).getByRole('button', { name: 'Abrir', exact: true }).click();
      await page.locator('#shell-current-system').filter({ hasText: 'Sistema de RPG' }).waitFor();
      await page.locator('#view-sheet:not([hidden])').waitFor();
    }
    for (const filled of [false, true]) {
      if (filled) {
        const data = populate(await page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get())), id);
        await writeFile(`${dir}/${id}-example.json`, JSON.stringify(data, null, 2));
        await page.locator('#input-import-file').setInputFiles({ name: 'example.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
        await page.locator('#shell-current-character').filter({ hasText: 'Lia' }).waitFor();
        await page.locator('#view-sheet:not([hidden])').waitFor();
      }
      if (id === 'dnd2024') await page.locator('[data-dnd-presentation="engine"]').click();
      if (phase === 'styled') await page.evaluate(async ({ id, filled }) => {
        const theme = await import('/js/theme.js');
        theme.applyPalette(id === 'dnd2024' ? 'classic' : 'forest');
        theme.applyTheme('light');
        (await import('/js/artwork.js')).applyArtworkPreferences({ artwork: { enabled: filled, intensity: 'soft', selected: [{ id: 'botanical-sprig', position: 'left' }, { id: 'botanical-petals', position: 'center' }, { id: 'arcane-orbits', position: 'right' }] } });
      }, { id, filled });
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await screenshot({ path: `${dir}/${id}-${filled ? 'filled' : 'empty'}-${width}.png`, fullPage: true });
        const firstValue = await page.locator('#generic-sheet-host input:not([type="file"])').first().boundingBox();
        report.samples.push({ id, filled, width, firstValueY: firstValue?.y, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
      }
      await page.pdf({ path: `${dir}/${id}-${filled ? 'filled' : 'empty'}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    }
  }
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await screenshot({ path: `${dir}/settings-${width}.png`, fullPage: true });
  }
  if (phase === 'after') {
    await page.getByRole('tab', { name: 'Dados', exact: true }).click();
    await page.locator('#dice-display-mode').selectOption('illustrated');
    await page.getByRole('tab', { name: 'Ornamentos', exact: true }).click();
    await page.locator('#ornament-preset').selectOption('garden');
    await page.locator('[data-family="botanical"] summary').click();
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await screenshot({ path: `${dir}/settings-ornaments-${width}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
    await page.getByRole('tab', { name: 'Atributos', exact: true }).click();
    for (const palette of ['classic', 'editorial', 'forest', 'ruby', 'monochrome', 'petals']) for (const theme of ['light', 'dark']) {
      await page.evaluate(async ({ palette, theme }) => { const api = await import('/js/theme.js'); api.applyPalette(palette); api.applyTheme(theme); }, { palette, theme });
      await screenshot({ path: `${dir}/palette-${palette}-${theme}.png`, fullPage: false });
    }
    await page.setViewportSize({ width: 360, height: 900 });
    await screenshot({ path: `${dir}/ornaments-mobile.png`, fullPage: false });
    await page.evaluate(async () => { const api = await import('/js/theme.js'); api.applyPalette('classic'); api.applyTheme('dark'); });
  }
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: 'D&D' }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await page.locator('[data-dnd-presentation="compare"]').click();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await screenshot({ path: `${dir}/compare-${width}.png`, fullPage: true });
  }
} finally {
  await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
