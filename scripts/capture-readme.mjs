// Capturas reais, com personagem fictício e contexto isolado do navegador.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startStaticServer } from '../tests/static-server.mjs';
import { populate } from '../tests/design-fixtures.mjs';

const folder = 'assets/readme';
await mkdir(folder, { recursive: true });
const server = await startStaticServer(4175);
const browser = await chromium.launch({ channel: 'msedge' });
const report = { browser: browser.version(), samples: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://127.0.0.1:4175');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const example = populate(await page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get())), 'dnd2024');
  example.identity.name = 'Lia Ventos';
  example.identity.player = 'Demo';
  example.identity.species = 'Humana';
  example.identity.background = 'Exploradora';
  await page.locator('#input-import-file').setInputFiles({ name: 'demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(example)) });
  await expect(page.locator('#shell-current-character')).toHaveText('Lia Ventos');
  await page.evaluate(async () => {
    const theme = await import('/js/theme.js'); theme.applyPalette('classic'); theme.applyTheme('light');
    (await import('/js/artwork.js')).applyArtworkPreferences({ artwork: { enabled: true, intensity: 'soft', selected: [{ id: 'botanical-sprig', position: 'left' }, { id: 'arcane-orbits', position: 'right' }] } });
  });
  const capture = async name => {
    await page.waitForFunction(() => !document.querySelector('.toast--visible'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `${folder}/${name}.png`, animations: 'disabled' });
    report.samples.push({ name, viewport: page.viewportSize(), overflow });
  };
  await capture('ficha-desktop');
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(async () => (await import('/js/theme.js')).applyTheme('dark'));
  await capture('ficha-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await capture('aparencia');
  await page.getByRole('button', { name: 'Ficha atual', exact: true }).click();
  await page.locator('#btn-print').click();
  await expect(page.locator('#print-options')).toBeVisible();
  await page.locator('#print-options').getByRole('radio', { name: /^Compacto/ }).check();
  await capture('exportacao');
  expect(report.errors).toEqual([]);
  await mkdir('output/readme', { recursive: true });
  await writeFile('output/readme/capture-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
