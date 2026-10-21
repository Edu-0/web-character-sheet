import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,mkdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {_electron as electron,expect} from '@playwright/test';
import {minimalPackage} from '../legacy-editor-package.js';

const parent=resolve('output/desktop');
const builds=await readdir(parent,{withFileTypes:true});
const latest=builds.filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
let executable=process.env.FICHA_DESKTOP_EXECUTABLE;
if(!executable){
  const {stat}=await import('node:fs/promises');
  const dated=await Promise.all(latest.map(async name=>({name,mtime:(await stat(join(parent,name))).mtimeMs})));
  dated.sort((a,b)=>b.mtime-a.mtime);
  if(!dated.length)throw Error('Execute npm run build:desktop antes do teste.');
  executable=join(parent,dated[0].name,'win-unpacked/Ficha RPG.exe');
}
await mkdir('tmp/desktop-tests',{recursive:true});

test('packaged Windows app: offline, isolated renderer, D&D parity, authoring, guides, themes and persistent profile', {timeout:180000},async t=>{
  const profile=await mkdtemp(resolve('tmp/desktop-tests/profile-'));
  const errors=[];
  const launch=async()=>{
    const env={...process.env,FICHA_DESKTOP_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
    const app=await electron.launch({executablePath:executable,env,timeout:45000});
    // Only this disposable fixture profile may discard an unsaved imported test package.
    await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=()=>1;});
    await app.evaluate(({session,app})=>{session.defaultSession.on('will-download',(_event,item)=>item.setSavePath(app.getPath('userData')+'\\backup-test.json'));});
    const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>{void dialog.accept().catch(()=>{});});
    await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)',{timeout:20000});
    return {app,page};
  };
  let {app,page}=await launch();
  t.after(async()=>{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});});
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),profile);
  assert.equal(new URL(page.url()).origin,'null'); // custom URL; browser origin is tested in-page below.
  const security=await page.evaluate(()=>({node:typeof require,process:typeof process,secure:isSecureContext,origin:location.origin,random:typeof crypto.getRandomValues}));
  assert.deepEqual(security,{node:'undefined',process:'undefined',secure:true,origin:'ficha://app',random:'function'});
  await app.evaluate(({session})=>session.defaultSession.enableNetworkEmulation({offline:true}));
  await page.getByRole('button',{name:'Ficha estática',exact:true}).click();
  await page.locator('[data-bind="identity.name"]').fill('Viajante Desktop');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo',{timeout:5000});
  await page.getByRole('button',{name:'Comparar lado a lado',exact:true}).click();
  await expect(page.locator('#generic-sheet-host')).toBeVisible();
  await expect(page.locator('#legacy-dnd-sheet')).toBeVisible();
  await expect(page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true})).toHaveValue('Viajante Desktop');
  await page.getByRole('button',{name:'Configurações',exact:true}).click();
  await expect(page.locator('#offline-status')).toContainText('Windows disponível offline');
  await expect(page.locator('#btn-check-update')).toBeHidden();
  await page.locator('#btn-export-library').click();
  await expect.poll(async()=>{try{return await readFile(join(profile,'backup-test.json'),'utf8');}catch{return '';}}).toContain('Viajante Desktop');
  assert.equal(JSON.parse(await readFile(join(profile,'backup-test.json'),'utf8')).kind,'rpg-library-backup');
  assert.equal(await page.evaluate(async()=> (await fetch('docs/private/continuidade.md')).status),404);
  assert.equal(await page.evaluate(async()=> (await fetch('sw.js')).status),404);
  // Inspect both themes at a narrow window, using the same preference applied by the UI.
  for(const theme of ['light','dark']){
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    await page.setViewportSize({width:420,height:820});
    await page.screenshot({path:`tmp/desktop-tests/${theme}.png`});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();
  await page.locator('#input-editor-file').setInputFiles({name:'desktop-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(minimalPackage('desktop-test')))});
  await expect(page.locator('#view-editor')).toBeVisible();
  await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão');
  await page.locator('button[data-workspace-area="sheet"]').click();
  await expect(page.locator('.editor-preview-frame')).toBeAttached({timeout:20000});
  await expect(page.frameLocator('.editor-preview-frame:not([hidden])').getByLabel('Nome',{exact:true})).toBeVisible({timeout:20000});
  await page.frameLocator('.editor-preview-frame:not([hidden])').getByLabel('Nome',{exact:true}).click();
  await page.locator('.editor-authoring-help > summary').click();
  const popup=page.waitForEvent('popup');
  await page.getByRole('link',{name:'Guia de autoria visual'}).click();
  const guide=await popup;await guide.waitForLoadState();
  await expect(guide.locator('body')).toContainText('autoria');await guide.close();
  // A pristine authoring draft has no pending edits; closing does not discard data.
  await app.close();
  ({app,page}=await launch());
  await page.getByRole('button',{name:'Ficha atual',exact:true}).click();
  await page.getByRole('button',{name:'Ficha estática',exact:true}).click();
  await expect(page.locator('[data-bind="identity.name"]')).toHaveValue('Viajante Desktop');
  assert.deepEqual(errors,[]);
});
