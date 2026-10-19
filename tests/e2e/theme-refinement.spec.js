import {test, expect} from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)', {timeout: 15000});
}
async function appearance(page, theme, palette) {
  await page.evaluate(async ({theme, palette}) => {
    const ui = await import('/js/theme.js'); ui.applyPalette(palette); ui.applyTheme(theme);
  }, {theme, palette});
}
async function openEntry(page) {
  await ready(page);
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('features', [{id: 'moon', name: 'Passo lunar', source: 'Classe', usesCurrent: 2, usesMax: 3, recoverOn: 'shortRest', description: 'Caminha pela luz da lua.', notes: 'Nota da mesa'}]));
  await page.locator('#generic-sheet-host').getByRole('tab', {name: 'Habilidades', exact: true}).click();
  await page.getByRole('button', {name: 'Editar Passo lunar', exact: true}).click();
  return page.locator('dialog.engine-entry-editor[open]');
}

// Compare actual computed colors, including color-mix(), rather than token strings.
async function contrast(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const swatch = document.createElement('span'); document.body.append(swatch);
    const resolve = value => {swatch.style.color = value; return getComputedStyle(swatch).color;};
    const rgb = value => {
      const numbers = value.match(/[\d.]+/g).map(Number);
      if (value.startsWith('color(srgb')) return numbers.slice(0, 3);
      return numbers.slice(0, 3).map(n => n / 255);
    };
    const lum = value => rgb(value).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
    const token = name => resolve(root.getPropertyValue('--color-' + name));
    const surfaces = ['bg', 'panel', 'panel-alt', 'input'].map(token);
    const text = ['text', 'text-muted', 'text-faint', 'accent-strong'].flatMap(name => surfaces.map(bg => ({name, bg, ratio: ratio(token(name), bg)})));
    const components = ['input-border', 'focus', 'choice-border'].flatMap(name => surfaces.map(bg => ({name, bg, ratio: ratio(token(name), bg)})));
    const primary = ratio(token('accent'), token('accent-contrast'));
    const input = document.querySelector('dialog[open] input:not([type="radio"]):not([type="checkbox"])');
    const styles = getComputedStyle(input);
    const actual = {text: ratio(styles.color, styles.backgroundColor), focus: ratio(styles.borderTopColor, styles.backgroundColor), outline: styles.outlineStyle};
    swatch.remove(); return {text, components, primary, actual};
  });
}

test('superfícies e controles têm contraste nas seis paletas, em ambos os temas', async ({page}, testInfo) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const box = await openEntry(page), input = box.getByLabel('Nome', {exact: true});
  const before = await page.evaluate(async () => JSON.stringify((await import('/js/state.js')).state.get()));
  const matrix = [];
  for (const theme of ['light', 'dark']) for (const palette of ['classic', 'editorial', 'forest', 'ruby', 'monochrome', 'petals']) {
    await appearance(page, theme, palette); await input.focus();
    await input.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const result = await contrast(page); matrix.push({theme, palette, ...result});
    expect(Math.min(...result.text.map(row => row.ratio)), `${theme}/${palette} text`).toBeGreaterThanOrEqual(4.5);
    expect(Math.min(...result.components.map(row => row.ratio)), `${theme}/${palette} boundaries`).toBeGreaterThanOrEqual(3);
    expect(result.primary, `${theme}/${palette} primary`).toBeGreaterThanOrEqual(4.5);
    expect(result.actual.text).toBeGreaterThanOrEqual(4.5); expect(result.actual.focus).toBeGreaterThanOrEqual(3);
    expect(result.actual.outline).toBe('none');
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const footer = await box.getByRole('button', {name: 'Salvar', exact: true}).boundingBox();
      expect(footer.y + footer.height).toBeLessThanOrEqual(1000);
      if (palette === 'petals' && width !== 768) await page.screenshot({path: testInfo.outputPath(`petals-${theme}-${width}.png`), animations: 'disabled'});
    }
  }
  await box.getByRole('button', {name: 'Cancelar', exact: true}).click();
  expect(await page.evaluate(async () => JSON.stringify((await import('/js/state.js')).state.get()))).toBe(before);
  expect(errors).toEqual([]);
  await testInfo.attach('contrast-matrix', {body: JSON.stringify(matrix, null, 2), contentType: 'application/json'});
});

test('hover, foco, erro, desabilitado, escolhas e redução de movimento preservam indicadores', async ({page}) => {
  const box = await openEntry(page), input = box.getByLabel('Nome', {exact: true});
  for (const theme of ['light', 'dark']) {
    await appearance(page, theme, 'petals');
    await box.getByLabel('Descrição', {exact: true}).focus(); await input.hover();
    await input.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const hover = await input.evaluate(el => getComputedStyle(el).borderTopColor);
    await input.focus(); await expect.poll(() => input.evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(hover);
    await input.evaluate(el => el.setAttribute('aria-invalid', 'true'));
    await input.evaluate(el => el.style.setProperty('--color-danger-strong', '#c00000'));
    await expect(input).toHaveCSS('border-top-color', 'rgb(192, 0, 0)');
    await box.getByLabel('Descrição', {exact: true}).focus(); await input.hover();
    await expect(input).toHaveCSS('border-top-color', 'rgb(192, 0, 0)');
    await input.evaluate(el => {el.removeAttribute('aria-invalid'); el.style.removeProperty('--color-danger-strong'); el.disabled = true;});
    await expect(input).toBeDisabled(); await expect(input).toHaveCSS('cursor', 'not-allowed');
    await input.evaluate(el => {el.disabled = false;});
    const short = box.getByRole('radio', {name: 'Descanso curto ou longo', exact: true}), long = box.getByRole('radio', {name: 'Somente descanso longo', exact: true});
    await short.focus(); await page.keyboard.press('ArrowDown');
    await expect(long).toBeChecked(); await expect(short).not.toBeChecked();
    await expect(long).toHaveCSS('outline-style', 'solid');
    await box.getByRole('button', {name: 'Cancelar', exact: true}).focus();
    await expect(box.getByRole('button', {name: 'Cancelar', exact: true})).toHaveCSS('outline-style', 'solid');
  }
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(input).toHaveCSS('transition-duration', '0s');
  await page.emulateMedia({forcedColors: 'active'}); await input.focus();
  await expect(input).toHaveCSS('outline-style', 'solid');
  await expect(box.getByRole('radio').first()).toHaveCSS('appearance', 'auto');
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'no-preference'});
  await box.getByRole('button', {name: 'Cancelar', exact: true}).click();
  await page.locator('#generic-sheet-host').getByRole('tab', {name: 'Identidade', exact: true}).click();
  const checkbox = page.getByRole('checkbox', {name: 'Inspiração', exact: true});
  await expect(checkbox).toHaveCSS('appearance', 'auto');
});

test('agrupamento discreto também atende calculados genéricos fora de D&D', async ({page}) => {
  await ready(page); await appearance(page, 'light', 'petals');
  await page.getByRole('button', {name: 'Sistemas', exact: true}).click();
  await page.locator('#systems-list [data-system-id="swade"]').getByRole('button', {name: 'Abrir', exact: true}).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Savage Worlds SWADE');
  await page.getByRole('tab', {name: 'Combate e recursos', exact: true}).click();
  const value = page.locator('.engine-computed').first();
  await expect(value).toBeVisible(); await expect(value).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(value).toHaveCSS('border-top-width', '0px'); await expect(value).toHaveCSS('border-bottom-width', '1px');
  expect(await value.locator('.engine-computed__value').textContent()).not.toBe('');
  await appearance(page, 'dark', 'petals');
  expect(await value.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});
