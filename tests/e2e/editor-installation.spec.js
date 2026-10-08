import {test,expect} from '@playwright/test';
import {minimalPackage} from '../../js/editor/minimal-package.js';
async function ready(page){await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForTimeout(350);}

test('navegação aguarda inicialização da ficha e preserva view escolhida',async({page})=>{
  let release;await page.route('**/data/systems/index.json',async route=>{await new Promise(resolve=>release=resolve);await route.continue();});await page.goto('/');
  const settings=page.getByRole('button',{name:'Configurações',exact:true});await expect(settings).toBeDisabled();expect(release).toBeTruthy();release();await expect(settings).toBeEnabled();await settings.click();await expect(page.locator('#view-settings')).toBeVisible();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});
test('escritores de duas abas preservam índices, pacotes e preferências sob a mesma trava',async({page,context})=>{
  await ready(page);const second=await context.newPage();await ready(second);const pkg=minimalPackage('coordinated-test');
  await page.evaluate(async pkg=>await(await import('/js/repositories/system-repository.js')).importSystemPackage(new File([JSON.stringify(pkg)],'pkg.json')),pkg);
  const results=await Promise.all([page.evaluate(async pkg=>{const repo=await import('/js/repositories/character-repository.js');const created=[];for(let i=0;i<3;i++)created.push((await repo.createCharacter(pkg.system)).meta.id);return created;},pkg),second.evaluate(async pkg=>{const repo=await import('/js/repositories/character-repository.js');const created=[];for(let i=0;i<3;i++)created.push((await repo.createCharacter(pkg.system)).meta.id);return created;},pkg)]);
  const ids=results.flat();const index=await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:v2:characters:index')));const documents=await page.evaluate(async()=>{const repo=await import('/js/repositories/character-repository.js');return {keys:Object.keys(localStorage).filter(key=>key.startsWith('ficha-rpg:v2:characters:')),characters:repo.allCharacters()};});expect(ids.every(id=>index.some(entry=>entry.id===id)),JSON.stringify({ids,index,documents})).toBe(true);expect(index.length).toBe(7);
  await Promise.all([page.evaluate(async()=>{const api=await import('/js/storage.js');await api.saveSettings({...api.loadSettings(),foo:0});}),second.evaluate(async()=>{const api=await import('/js/storage.js');await api.saveSettings({...api.loadSettings(),bar:false});})]);
  const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:settings')));expect(preferences.foo).toBe(0);expect(preferences.bar).toBe(false);expect(await page.evaluate(()=>localStorage.getItem('ficha-rpg:v2:storage-journal'))).toBeNull();
});
test('plano relê conjunto completo após await, recusa novo vinculado e cache de outra aba',async({page,context})=>{
  await ready(page);const pkg=minimalPackage('preflight-test');await page.evaluate(async pkg=>{const api=await import('/js/repositories/system-repository.js');await api.importSystemPackage(new File([JSON.stringify(pkg)],'pkg.json'));window.installPlan=api.prepareSystemInstallation(pkg);},pkg);
  const second=await context.newPage();await ready(second);await second.evaluate(async pkg=>{await(await import('/js/repositories/character-repository.js')).createCharacter(pkg.system);},pkg);
  const result=await page.evaluate(async()=>{const api=await import('/js/repositories/system-repository.js');const before=localStorage.getItem('ficha-rpg:v2:systems');try{await api.installSystemPackage(window.installPlan);return false;}catch(error){return {message:error.message,same:before===localStorage.getItem('ficha-rpg:v2:systems')};}});expect(result.same).toBe(true);expect(result.message).toContain('mudou');
  await second.evaluate(async pkg=>{const api=await import('/js/repositories/system-repository.js');pkg.system.name='Outra aba';const plan=api.prepareSystemInstallation(pkg);await api.installSystemPackage(plan);},pkg);
  expect(await page.evaluate(async pkg=>{const api=await import('/js/repositories/system-repository.js');try{api.prepareSystemInstallation(pkg,{expectedBase:pkg});return false;}catch{return true;}},pkg)).toBe(true);
});
test('sem locks ou janela antiga, substituição é bloqueada e original permanece',async({page,context})=>{
  await ready(page);const pkg=minimalPackage('unsupported-lock-test');await page.evaluate(async pkg=>await(await import('/js/repositories/system-repository.js')).importSystemPackage(new File([JSON.stringify(pkg)],'pkg.json')),pkg);
  const old=await context.newPage();await old.goto('/test-engine.html');
  const result=await page.evaluate(async pkg=>{const api=await import('/js/repositories/system-repository.js'),before=localStorage.getItem('ficha-rpg:v2:systems');try{await api.installSystemPackage(api.prepareSystemInstallation(pkg));return false;}catch(error){return {same:before===localStorage.getItem('ficha-rpg:v2:systems'),message:error.message};}},pkg);expect(result.same).toBe(true);expect(result.message).toContain('janela antiga');await old.close();
  const absent=await page.evaluate(async pkg=>{Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});const api=await import('/js/repositories/system-repository.js');try{await api.installSystemPackage(api.prepareSystemInstallation(pkg));return false;}catch(error){return error.message;}},pkg);expect(absent).toContain('Web Locks');
});

test('save na fila mantém aviso de saída e retoma a presença após pageshow persisted',async({page,context})=>{
  await ready(page);await expect(page.locator('#save-indicator')).toHaveText('Salvo');const second=await context.newPage();await ready(second);
  await second.evaluate(async()=>await new Promise(resolve=>{navigator.locks.request('ficha-rpg:library-write:v1',()=>{resolve();return new Promise(release=>window.releaseTestLock=release);});}));
  try{
    await page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true}).fill('Fila segura');await page.waitForTimeout(450);await expect(page.locator('#save-indicator')).toHaveText('Salvando...');
    expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
  }finally{await second.evaluate(()=>window.releaseTestLock());}
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.evaluate(async()=>{const writes=await import('/js/write-coordinator.js');await writes.flushLibraryWrites();window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));const settings=await import('/js/storage.js');await settings.saveSettings({...settings.loadSettings(),resumeSentinel:false});});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:settings')).resumeSentinel)).toBe(false);
  expect(await page.evaluate(async()=>{const {state}=await import('/js/state.js');return JSON.parse(localStorage.getItem('ficha-rpg:v2:characters:'+state.get().meta.id)).identity.name;})).toBe('Fila segura');
});

test('vinculado corrompido/ausente conserva sistema do índice e bloqueia replace',async({page})=>{
  await ready(page);const pkg=minimalPackage('unavailable-linked');
  const result=await page.evaluate(async pkg=>{
    const systems=await import('/js/repositories/system-repository.js'),characters=await import('/js/repositories/character-repository.js'),writes=await import('/js/write-coordinator.js');await systems.importSystemPackage(new File([JSON.stringify(pkg)],'pkg.json'));const character=await characters.createCharacter(pkg.system);await writes.flushLibraryWrites();
    const key='ficha-rpg:v2:characters:'+character.meta.id,before=localStorage.getItem('ficha-rpg:v2:systems'),reports=[];
    for(const raw of ['{ broken',null]){if(raw===null)localStorage.removeItem(key);else localStorage.setItem(key,raw);const summary=characters.listCharacters().find(entry=>entry.id===character.meta.id);let message;try{systems.prepareSystemInstallation(pkg);}catch(error){message=error.message;}reports.push({summary,message,same:localStorage.getItem('ficha-rpg:v2:systems')===before});await writes.flushLibraryWrites();}
    const index=JSON.parse(localStorage.getItem('ficha-rpg:v2:characters:index'));localStorage.setItem('ficha-rpg:v2:characters:index',JSON.stringify(index.filter(entry=>entry.id!==character.meta.id)));localStorage.setItem(key,'{ unknown');let unknown;try{systems.prepareSystemInstallation(pkg);}catch(error){unknown=error.message;}return {reports,unknown};
  },pkg);for(const report of result.reports){expect(report.summary.system).toBe(pkg.system.id);expect(report.summary.unavailable).toBe(true);expect(report.message).toContain('indisponível');expect(report.same).toBe(true);}expect(result.unknown).toContain('sem identificação');
});
