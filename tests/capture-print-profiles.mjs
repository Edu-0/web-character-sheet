// Captura isolada da escolha de formato; execute fora da suíte na porta 4173.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startStaticServer } from './static-server.mjs';

const folder = 'output/design/print-profiles';
await mkdir(folder, { recursive: true });
const server = await startStaticServer(4175);
const browser = await chromium.launch({ channel: 'msedge' });
const report = { browser: browser.version(), samples: [], errors: [] };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://127.0.0.1:4175');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async theme => (await import('/js/theme.js')).applyTheme(theme), theme);
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      if (width <= 900) await page.getByRole('button', { name: 'Mais', exact: true }).click();
      await page.locator('#btn-print').click();
      const dialog = page.locator('#print-options');
      await dialog.getByRole('radio', { name: /^Compacto/ }).check();
      await page.screenshot({ path: `${folder}/${theme}-${width}.png`, animations: 'disabled' });
      report.samples.push(await dialog.evaluate((el, sample) => {
        const rect = el.getBoundingClientRect();
        return { ...sample, inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, overflow: document.documentElement.scrollWidth > innerWidth };
      }, { theme, width }));
      await page.keyboard.press('Escape');
    }
  }
  expect(report.errors).toEqual([]);
  expect(report.samples.every(sample => sample.inViewport && !sample.overflow)).toBe(true);
  await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
