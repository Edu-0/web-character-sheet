import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {startPwaServer} from '../pwa-server.mjs';
const open=async page=>{await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.getByRole('button',{name:'Criar pacote',exact:true}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0',{timeout:20000});};

test('os oito sistemas e seus layouts renderizam; falha conserva ensaio anterior funcional',async({page})=>{
  test.setTimeout(90000);await open(page);
  const result=await page.evaluate(async()=>{
    const repo=await import('/js/repositories/system-repository.js'),{PreviewHost}=await import('/js/editor/preview-host.js');const node=document.createElement('div');document.body.append(node);const host=new PreviewHost(node);const ids=[];
    for(const system of repo.listSystems().filter(system=>system.source==='builtin')){const pkg=await repo.getSystemPackage(system.id);for(const layout of pkg.layouts){await host.mount(pkg,{revision:1,layoutId:layout.id});const sample=await host.snapshot();if(sample.character.meta.system!==system.id)throw new Error('Contexto incorreto');ids.push([system.id,layout.id]);}}
    let failed=false;try{await host.mount({},{revision:2,layoutId:'missing'});}catch{failed=true;}const retained=await host.snapshot();host.dispose();node.remove();return {ids,failed,retained:retained.character.meta.system};
  });expect(new Set(result.ids.map(([id])=>id)).size).toBe(8);expect(result.ids.length).toBe(16);expect(result.failed).toBe(true);expect(result.retained).toBeTruthy();
});

test('toque, IME, atalhos e seis combinações de largura/tema preservam foco e texto',async({browser},testInfo)=>{
  const context=await browser.newContext({hasTouch:true,viewport:{width:360,height:900}});const page=await context.newPage();try{
    await open(page);const area=page.locator('#editor-json'),original=await area.inputValue();
    await area.evaluate(node=>{node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));node.value='{ composição';node.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText'}));});await page.waitForTimeout(400);await expect(area).toHaveValue('{ composição');
    await area.evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await expect(page.locator('#editor-validation-summary')).toContainText('JSON inválido');await area.press('Control+z');await expect(area).toHaveValue(original);await area.press('Control+k');await expect(page.locator('#view-editor')).toBeVisible();await expect(area).toBeFocused();
    for(const width of [360,768,1280])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);if(width<900)await page.locator('.editor-mobile-tabs').getByRole('button',{name:'Prévia',exact:true}).tap();await page.getByLabel('Tema do ensaio').selectOption(theme);
      if(width<900){await page.locator('.editor-mobile-tabs').getByRole('button',{name:'Prévia',exact:true}).tap();await expect(page.locator('.editor-preview')).toBeVisible();await page.locator('.editor-mobile-tabs').getByRole('button',{name:'JSON',exact:true}).tap();}
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath(`touch-${width}-${theme}.png`),fullPage:true});
    }
    await page.evaluate(()=>document.documentElement.style.zoom='2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await area.press('Control+s');await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');await page.getByRole('button',{name:'Sair do editor'}).tap();await expect(page.locator('#view-systems')).toBeVisible();
  }finally{await context.close();}
});

test('sair antes do autosave descarta só edição pendente; Escape conserva texto',async({page})=>{
  await open(page);await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');const original=await page.locator('#editor-json').inputValue();
  await page.locator('#editor-json').fill('{ pending');await page.getByRole('button',{name:'Sair do editor'}).click();await page.getByRole('dialog').press('Escape');await expect(page.locator('#editor-json')).toHaveValue('{ pending');
  await page.locator('#editor-json').fill('{ discard');await page.getByRole('button',{name:'Sair do editor'}).click();await page.getByRole('button',{name:'Descartar e sair'}).click();await page.waitForTimeout(800);await page.getByRole('button',{name:'Recuperar rascunho'}).click();await expect(page.locator('#editor-json')).toHaveValue(original);
});

test('subpasta offline: criar/erro/recuperar/corrigir/exportar/reimportar/aplicar/sair',async({page,context})=>{
  const server=await startPwaServer();try{
    await page.goto(server.url);await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await context.setOffline(true);
    await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.getByRole('button',{name:'Criar pacote',exact:true}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');const pkg=JSON.parse(await page.locator('#editor-json').inputValue());pkg.extra={nil:null,zero:0,off:false,empty:''};
    await page.locator('#editor-json').fill('{ offline');await expect(page.locator('#editor-status')).toContainText('revisão 1');await page.reload();await page.getByRole('button',{name:'Recuperar rascunho'}).click();await expect(page.locator('#editor-json')).toHaveValue('{ offline');
    await page.locator('#editor-json').fill(JSON.stringify(pkg,null,2));await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();await expect(page.getByRole('button',{name:'Aplicar pacote',exact:true})).toBeEnabled();
    const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar pacote',exact:true}).click();const exported=JSON.parse(await readFile(await(await downloading).path(),'utf8'));expect(exported).toEqual(pkg);
    await page.getByRole('button',{name:'Aplicar pacote',exact:true}).click();await page.getByRole('button',{name:'Confirmar aplicação'}).click();await expect(page.locator('#editor-application-status')).toContainText('Pacote aplicado');await page.getByRole('button',{name:'Sair do editor'}).click();await expect(page.locator('#systems-list')).toContainText(pkg.system.name);
    await page.locator('#input-import-system').setInputFiles({name:'offline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByRole('button',{name:'Substituir sistema',exact:true}).click();await expect(page.locator('#systems-list')).toContainText(pkg.system.name);await page.reload();await expect(page.getByRole('button',{name:'Recuperar rascunho'})).toBeVisible();await page.getByRole('button',{name:'Recuperar rascunho'}).click();expect(JSON.parse(await page.locator('#editor-json').inputValue()).extra).toEqual(pkg.extra);await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão');
  }finally{await context.setOffline(false);await server.close();}
});

test('limite de 4 MiB e repeat de 10000 medidos sem truncar texto',async({page},testInfo)=>{
  test.setTimeout(90000);await open(page);
  const metrics=await page.evaluate(async()=>{
    const {EditorSession}=await import('/js/editor/session.js'),{minimalPackage}=await import('/js/editor/minimal-package.js'),{PreviewHost}=await import('/js/editor/preview-host.js');
    const pkg=minimalPackage('limits-test');pkg.extra=Array.from({length:40},()=> 'x'.repeat(100000));const raw=JSON.stringify(pkg),text=raw+' '.repeat(4*1024**2-raw.length),start=performance.now(),session=new EditorSession({text});const validateMs=performance.now()-start;
    const valid=session.validation.status;session.replaceText(text+' ');session.validate();const over=session.validation.status,bytes=session.text.length,boundary=session.history.boundary;
    const repeat=minimalPackage('repeat-test');repeat.system.catalog=Array.from({length:10000},(_,i)=>({key:`k${i}`}));repeat.layouts[0].tabs[0].sections[0].containers=[{id:'repeat',repeat:{source:'catalog'},components:[{type:'text',field:'values.{key}',label:'Entrada {index}'}]}];repeat.system.characterTemplate.values={};
    const node=document.createElement('div');node.id='repeat-measure';document.body.append(node);const host=new PreviewHost(node);window.repeatHost=host;const mountStart=performance.now();await host.mount(repeat,{revision:1,layoutId:'default'});const mountMs=performance.now()-mountStart;return {validateMs,mountMs,valid,over,bytes,boundary};
  });expect(metrics.valid).toBe('ready');expect(metrics.over).toBe('invalid');expect(metrics.bytes).toBe(4*1024**2+1);expect(metrics.boundary).toBe(true);await expect(page.frameLocator('#repeat-measure iframe').locator('input[type=text]')).toHaveCount(10000);await page.evaluate(()=>{window.repeatHost.dispose();document.getElementById('repeat-measure').remove();});await writeFile(testInfo.outputPath('limit-metrics.json'),JSON.stringify(metrics,null,2));
});

test('erro tardio do ensaio anterior não invalida montagem nova bem-sucedida',async({page})=>{
  await open(page);await page.evaluate(async()=>{const {PreviewHost}=await import('/js/editor/preview-host.js'),mount=PreviewHost.prototype.mount;window.previewGate=new Promise(resolve=>{window.releasePreview=resolve;});PreviewHost.prototype.mount=async function(...args){await window.previewGate;return mount.apply(this,args);};});
  const area=page.locator('#editor-json'),pkg=JSON.parse(await area.inputValue());pkg.system.name='Ensaio novo';await area.fill(JSON.stringify(pkg));await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();await expect(page.locator('#editor-preview-status')).toHaveText('Montando ensaio…');
  await page.frameLocator('.editor-preview-frame:not([hidden])').locator('body').evaluate(()=>{setTimeout(()=>{throw new Error('falha tardia do ensaio anterior');},0);});await expect(page.locator('#editor-preview-status')).toContainText('falha tardia do ensaio anterior');await page.evaluate(()=>window.releasePreview());
  await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 1');await expect(page.getByRole('button',{name:'Aplicar pacote',exact:true})).toBeEnabled();
});

test('fechar imagem async/modal e mensagens tardias não altera dados reais',async({page})=>{
  await open(page);await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');const before=await page.evaluate(async()=>({character:structuredClone((await import('/js/state.js')).state.get()),keys:Object.fromEntries(Object.entries(localStorage).filter(([key])=>!key.startsWith('ficha-rpg:editor:')))}));
  const pkg=minimalPackage('image-test');pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'image',field:'portrait',label:'Retrato'});await page.locator('#editor-json').fill(JSON.stringify(pkg));await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão');const frame=page.frameLocator('.editor-preview-frame:not([hidden])');
  await frame.locator('body').evaluate(()=>{Image.prototype.decode=()=>new Promise(resolve=>setTimeout(resolve,2000));setTimeout(()=>parent.postMessage({type:'rendered',protocol:1,revision:999},'*'),1500);});
  await frame.locator('input[type=file]').setInputFiles({name:'portrait.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')});
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');await page.getByRole('button',{name:'Sair do editor'}).click();await expect(page.locator('.editor-preview-frame')).toHaveCount(0);await page.waitForTimeout(2300);
  expect(await page.evaluate(async()=>({character:structuredClone((await import('/js/state.js')).state.get()),keys:Object.fromEntries(Object.entries(localStorage).filter(([key])=>!key.startsWith('ficha-rpg:editor:')))}))).toEqual(before);
});
