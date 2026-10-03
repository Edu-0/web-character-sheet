import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildOffline } from '../../scripts/build-offline.mjs';
import { startPwaServer } from '../pwa-server.mjs';

const host = '#generic-sheet-host';
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  errors.set(page, []); page.on('pageerror', error => errors.get(page).push(error.message));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function warm(page, url = '/') {
  await page.goto(url); await expect(page.locator('#sheet-layout-select')).toHaveValue('dnd2024-layout');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.locator(host).getByRole('tab', { name: 'Identidade', exact: true })).toBeVisible();
}
async function settings(page) { await page.getByRole('button', { name: 'Configurações', exact: true }).click(); }
async function sheet(page) { await page.getByRole('button', { name: 'Ficha atual', exact: true }).click(); }
async function reopenPrepared(page) {
  await Promise.all([page.waitForEvent('load'), page.locator('#btn-enable-offline').click()]);
  await expect(page.locator('#sheet-layout-select')).toHaveValue('dnd2024-layout');
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
async function openSystem(page, name) {
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#systems-list .library-card').filter({ hasText: name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('#shell-current-system')).toHaveText(name);
}
async function values(page) { return page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get())); }
async function versions(page) { return page.evaluate(async () => (await caches.keys()).filter(key => key.startsWith('ficha-rpg-offline:'))); }

test('manifesto instalável, ícones locais e lista offline somente com runtime público', async ({ page }) => {
  await warm(page);
  const cdp = await page.context().newCDPSession(page);
  const manifest = await cdp.send('Page.getAppManifest'); expect(manifest.errors).toEqual([]);
  const data = JSON.parse(manifest.data); expect(data.display).toBe('standalone'); expect(data.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
  const result = await page.evaluate(async () => {
    const manifest = await (await fetch('./manifest.webmanifest')).json();
    const sizes = await Promise.all(manifest.icons.map(async icon => { const img = new Image(); img.src = icon.src; await img.decode(); return [img.naturalWidth, img.naturalHeight]; }));
    const [name] = (await caches.keys()).filter(key => key.startsWith('ficha-rpg-offline:'));
    return { sizes, paths: (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname) };
  });
  expect(result.sizes).toEqual([[192, 192], [512, 512]]);
  expect(result.paths).toContain('/data/systems/sistema-rpg.table-layout.json');
  expect(result.paths.some(path => /docs\/|test|readme|backups|exports/.test(path))).toBe(false);
  const bundle = await buildOffline({ write: false }); expect(result.paths).toHaveLength(bundle.assets.length);
});

test('offline abre sistemas ainda não visitados, salva, desfaz e reabre em outra janela', async ({ page, context }) => {
  await warm(page); await context.setOffline(true);
  await page.reload();
  const name = page.locator(host).getByLabel('Nome do personagem', { exact: true });
  await name.fill('Viajante offline'); await page.locator('#btn-undo-edit').click(); await page.locator('#btn-redo-edit').click();
  await expect(name).toHaveValue('Viajante offline'); await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  const id = (await values(page)).meta.id;
  await openSystem(page, 'Sistema de RPG');
  await page.locator('#sheet-layout-select').selectOption('sistema-rpg-table');
  await page.getByRole('tab', { name: 'Notas', exact: true }).click(); await page.locator(host).locator('textarea:visible').fill('Anotação sem rede');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload(); await expect(page.locator(host).locator('textarea:visible')).toHaveValue('Anotação sem rede');
  await openSystem(page, 'D&D 5e (2024)'); expect((await values(page)).meta.id).toBe(id); await expect(name).toHaveValue('Viajante offline');
  const second = await context.newPage(); await second.goto('/'); await expect(second.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Viajante offline');
  await second.close(); await settings(page); await expect(page.locator('#offline-status')).toContainText('Você está offline');
  await expect(page.locator('#btn-check-update')).toBeDisabled();
  const download = page.waitForEvent('download'); await page.locator('#btn-export-library').click();
  const backup = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(backup.characters.some(character => character.identity?.name === 'Viajante offline')).toBe(true);
  await sheet(page); await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root')).toContainText('Viajante offline');
});

test('importar pacote e retrato locais funciona offline e persiste', async ({ page, context }) => {
  await warm(page); await context.setOffline(true);
  const pkg = JSON.parse(await readFile('data/examples/recovery-actions.package.json', 'utf8'));
  await page.getByRole('button', { name: 'Sistemas', exact: true }).click();
  await page.locator('#input-import-system').setInputFiles({ name: 'offline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) });
  await page.locator('#systems-list .library-card').filter({ hasText: pkg.system.name }).getByRole('button', { name: 'Abrir', exact: true }).click();
  await page.getByRole('button', { name: 'Pausa', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Aplicar recuperação', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo'); await page.reload();
  await expect.poll(async () => (await values(page)).energy).toBe(8);
  await openSystem(page, 'D&D 5e (2024)');
  await page.locator(host).locator('input[type="file"]').setInputFiles('assets/app/icon-192.png');
  await expect(page.locator(`${host} .engine-image__preview`)).toBeVisible();
  await expect(page.locator('#save-indicator')).toHaveText('Salvo'); await page.reload();
  await expect(page.locator(`${host} .engine-image__preview`)).toBeVisible();
  await expect.poll(async () => (await values(page)).identity?.portrait).toMatch(/^data:image\//);
});

test('duas janelas permanecem na versão antiga até fechar; atualização conserva dados', async ({ page, context }) => {
  const server = await startPwaServer();
  try {
    await warm(page, server.url);
    await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Conservada na atualização');
    await expect(page.locator('#save-indicator')).toHaveText('Salvo');
    const second = await context.newPage(); await second.goto(server.url);
    const oldCache = await versions(page), oldTitle = await page.title();
    await page.evaluate(() => caches.open('outro-app-preservado'));
    const html = server.release.files.get('index.html').toString().replace('<title>Ficha de Personagem — RPG</title>', '<title>Ficha RPG atualizada</title>');
    const next = await server.next(new Map([['index.html', Buffer.from(html)]]));
    await settings(page); await page.locator('#btn-check-update').click();
    await expect(page.locator('#pwa-update-status')).toContainText('Atualização pronta');
    await page.reload(); expect(await page.title()).toBe(oldTitle); await second.reload(); expect(await second.title()).toBe(oldTitle);
    const cachesReady = await versions(page); expect(cachesReady).toHaveLength(2); expect(cachesReady.some(name => name.endsWith(next.version))).toBe(true);
    await second.close(); await page.close();
    const reopened = await context.newPage(); await context.setOffline(true); await reopened.goto(server.url);
    await expect(reopened).toHaveTitle('Ficha RPG atualizada'); await sheet(reopened);
    await expect(reopened.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Conservada na atualização');
    expect(await versions(reopened)).toHaveLength(1); expect(await versions(reopened)).not.toEqual(oldCache);
    expect(await reopened.evaluate(() => caches.keys())).toContain('outro-app-preservado');
    await reopened.close();
  } finally { await server.close(); }
});

test('preparação incompleta não anuncia offline; tentativa posterior completa o cache', async ({ page }) => {
  const server = await startPwaServer(); server.failures.set('assets/app/icon-512.png', true);
  try {
    await page.goto(server.url); await settings(page);
    await expect(page.locator('#offline-status')).toContainText('Não foi possível concluir');
    await expect(page.locator('#offline-status')).toContainText('assets/app/icon-512.png (HTTP 503)');
    expect(await versions(page)).toHaveLength(0);
    await sheet(page); await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Salva mesmo sem cache');
    await expect(page.locator('#save-indicator')).toHaveText('Salvo');
    server.failures.clear(); await settings(page); await page.locator('#btn-check-update').click();
    await expect(page.locator('#offline-status')).toContainText('Preparação concluída');
    await reopenPrepared(page); await sheet(page);
    await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Salva mesmo sem cache');
  } finally { await server.close(); }
});

test('deploy parcial com hash divergente preserva versão ativa e pode ser tentado de novo', async ({ page }) => {
  const server = await startPwaServer();
  try {
    await warm(page, server.url); const original = await versions(page);
    const nextCss = Buffer.concat([server.release.files.get('css/base.css'), Buffer.from('\n/* nova versão */\n')]);
    const next = await server.next(new Map([['css/base.css', nextCss]]));
    const correctSource = next.source;
    // O SW anuncia CSS novo, mas o servidor entrega CSS antigo: falha de integridade.
    next.files.set('css/base.css', Buffer.from('/* arquivo divergente */'));
    await settings(page); await page.locator('#btn-check-update').click();
    await expect(page.locator('#pwa-update-status')).toContainText('Não foi possível');
    await expect(page.locator('#pwa-update-status')).toContainText('css/base.css foi alterado');
    await expect(page.locator('#offline-status')).toContainText('Disponível offline'); expect(await versions(page)).toEqual(original);
    next.files.set('css/base.css', nextCss); expect(next.source).toBe(correctSource);
    await page.locator('#btn-check-update').click(); await expect(page.locator('#pwa-update-status')).toContainText('Atualização pronta');
  } finally { await server.close(); }
});

for (const suffix of ['', '\r\n']) test(`Live Server: HTML/SVG originais disponíveis offline (quebra final ${Boolean(suffix)})`, async ({ page, context }) => {
  const server = await startPwaServer({ liveReload: suffix });
  try {
    await page.goto(server.url);
    expect(await page.evaluate(() => window.fixtureLiveReload)).toBe(true);
    await settings(page); await expect(page.locator('#offline-status')).toContainText('Preparação concluída');
    // A resposta contém a injeção, mas o cache deve manter os bytes originais verificados.
    for (const path of ['index.html', 'assets/app/icon.svg']) {
      const bytes = await page.evaluate(async path => {
        const name = (await caches.keys()).find(key => key.startsWith('ficha-rpg-offline:'));
        return Array.from(new Uint8Array(await (await (await caches.open(name)).match(new URL(path, location.href))).arrayBuffer()));
      }, path);
      expect(createHash('sha256').update(Buffer.from(bytes)).digest('hex')).toBe(server.release.assets.find(asset => asset.path === path).hash);
    }
    await reopenPrepared(page); await sheet(page);
    await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Mesa no Live Server');
    await expect(page.locator('#save-indicator')).toHaveText('Salvo'); await context.setOffline(true); await page.reload();
    await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Mesa no Live Server');
    expect(await page.evaluate(() => window.fixtureLiveReload)).toBeUndefined();
    await expect(page.locator('#sheet-layout-select')).toHaveValue('dnd2024-layout');
  } finally { await server.close(); }
});

for (const fiveServer of [false, true]) test(`${fiveServer ? 'Five Server' : 'Live Server'} não mascara alterações reais nem impede retentar depois da correção`, async ({ page }) => {
  const server = await startPwaServer(fiveServer ? { fiveServer: true } : { liveReload: '\n' });
  try {
    const original = server.release.files.get('index.html');
    server.release.files.set('index.html', Buffer.from(original.toString().replace('<title>Ficha de Personagem — RPG</title>', '<title>Arquivo realmente diferente</title>')));
    await page.goto(server.url); await settings(page);
    await expect(page.locator('#offline-status')).toContainText('index.html foi alterado');
    expect(await versions(page)).toHaveLength(0);
    server.release.files.set('index.html', original); await page.locator('#btn-check-update').click();
    await expect(page.locator('#offline-status')).toContainText('Preparação concluída');
  } finally { await server.close(); }
});

test('Five Server: bloco no head com indentação prepara HTML original e reabre offline', async ({ page, context }) => {
  const server = await startPwaServer({ fiveServer: true });
  try {
    await page.goto(server.url); await settings(page);
    expect(await page.evaluate(() => window.fixtureFiveServer)).toBe(true);
    await expect(page.locator('#offline-status')).toContainText('Preparação concluída');
    const cached = await page.evaluate(async () => {
      const name = (await caches.keys()).find(key => key.startsWith('ficha-rpg-offline:'));
      const cache = await caches.open(name);
      return { bytes: Array.from(new Uint8Array(await (await cache.match(new URL('index.html', location.href))).arrayBuffer())),
        paths: (await cache.keys()).map(request => new URL(request.url).pathname) };
    });
    expect(createHash('sha256').update(Buffer.from(cached.bytes)).digest('hex')).toBe(server.release.assets.find(asset => asset.path === 'index.html').hash);
    expect(cached.paths.some(path => path.includes('fiveserver'))).toBe(false);
    await reopenPrepared(page); await sheet(page);
    await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Mesa no Five Server');
    await expect(page.locator('#save-indicator')).toHaveText('Salvo'); await context.setOffline(true); await page.reload();
    await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Mesa no Five Server');
    expect(await page.evaluate(() => window.fixtureFiveServer)).toBeUndefined();
  } finally { await server.close(); }
});

test('cache reparado não guarda navegação desconhecida, arquivos privados ou dados pessoais', async ({ page }) => {
  const server = await startPwaServer();
  try {
    await warm(page, server.url);
    await page.evaluate(async () => {
      const name = (await caches.keys()).find(name => name.startsWith('ficha-rpg-offline:'));
      await (await caches.open(name)).delete(new URL('data/systems/sistema-rpg.system.json', location.href));
      await fetch('./docs/private/fixture.txt'); await fetch('./nao-existe.html');
    });
    await settings(page); await page.locator('#btn-check-update').click();
    await expect(page.locator('#offline-status')).toContainText('Disponível offline');
    const paths = await page.evaluate(async () => {
      const name = (await caches.keys()).find(name => name.startsWith('ficha-rpg-offline:'));
      return (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname);
    });
    expect(paths.some(path => path.includes('docs/') || path.includes('nao-existe'))).toBe(false);
    expect(paths).toContain('/ficha/data/systems/sistema-rpg.system.json');
  } finally { await server.close(); }
});

test('instalação é oferecida somente pelo evento do navegador; cancelar permite continuar', async ({ page }) => {
  await warm(page); await settings(page);
  await page.evaluate(() => {
    window.installCount = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.installCount++; }; event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  });
  await expect(page.locator('#btn-install-app')).toBeVisible(); await page.locator('#btn-install-app').click();
  await expect(page.locator('#btn-install-app')).toBeHidden(); expect(await page.evaluate(() => window.installCount)).toBe(1);
  await sheet(page); await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Depois de cancelar');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
});

test('reabertura aguarda salvamento e falha de quota conserva edição na página', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => navigator.serviceWorker.ready); await settings(page);
  await expect(page.locator('#btn-enable-offline')).toBeVisible(); await sheet(page);
  await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Não perder ao reabrir');
  await settings(page);
  await page.evaluate(() => {
    window.originalStorageWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('ficha-rpg:v2:characters:')) throw new DOMException('Quota', 'QuotaExceededError'); return window.originalStorageWrite.call(this, key, value); };
    window.pageStillHere = true;
  });
  await page.locator('#btn-enable-offline').click();
  expect(await page.evaluate(() => window.pageStillHere)).toBe(true); expect((await values(page)).identity.name).toBe('Não perder ao reabrir');
  await expect(page.locator('#save-indicator')).toContainText('Não salvo');
  await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageWrite; });
  await page.locator('#btn-enable-offline').click(); await sheet(page);
  await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Não perder ao reabrir');
});

test('navegador sem service worker mantém a ficha e explica a limitação', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', { value: undefined }));
  await page.goto('/'); await settings(page);
  await expect(page.locator('#offline-status')).toContainText('Uso offline indisponível');
  await expect(page.locator('#btn-check-update')).toBeDisabled(); await expect(page.locator('#btn-enable-offline')).toBeHidden();
  await sheet(page); await page.locator(host).getByLabel('Nome do personagem', { exact: true }).fill('Navegador sem instalação');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo'); await page.reload();
  await expect(page.locator(host).getByLabel('Nome do personagem', { exact: true })).toHaveValue('Navegador sem instalação');
});

for (const width of [360, 1280]) for (const theme of ['light', 'dark']) test(`estado offline em configurações: ${width}px ${theme}`, async ({ page, context }, testInfo) => {
  await warm(page); await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async mode => (await import('/js/theme.js')).applyTheme(mode), theme);
  await context.setOffline(true); await settings(page);
  await expect(page.locator('#offline-status')).toContainText('Você está offline');
  await page.evaluate(() => {
    const header = document.querySelector('.shell-header').getBoundingClientRect().height;
    const nav = document.querySelector('.shell-nav');
    const navHeight = getComputedStyle(nav).position === 'sticky' ? nav.getBoundingClientRect().height : 0;
    window.scrollBy(0, document.querySelector('.pwa-settings').getBoundingClientRect().top - header - navHeight - 16);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`offline-settings-${width}-${theme}.png`), fullPage: false });
});
