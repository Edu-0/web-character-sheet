import {test,expect} from '@playwright/test';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {readFile} from 'node:fs/promises';

const membership='ficha-rpg:v2:catalog-installations';
const systemCard=(page,id)=>page.locator(`#systems-list [data-system-id="${id}"]`);
const catalogCard=(page,id)=>page.locator(`#catalog-list [data-system-id="${id}"]`);
async function ready(page){await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.evaluate(()=>navigator.serviceWorker.ready);await expect(page.locator('#save-indicator')).toHaveText('Salvo');await page.evaluate(async()=>await(await import('/js/write-coordinator.js')).flushLibraryWrites());}
async function systems(page){await page.getByRole('button',{name:'Sistemas',exact:true}).click();}
async function catalog(page){await page.getByRole('button',{name:'Catálogo',exact:true}).click();}
async function deleteUI(page,id){await systems(page);await systemCard(page,id).getByRole('button',{name:'Excluir sistema',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Excluir sistema e personagens',exact:true}).click();await expect(systemCard(page,id)).toHaveCount(0);}
async function installUI(page,id){await catalog(page);await catalogCard(page,id).getByRole('button',{name:'Instalar',exact:true}).click();await expect(catalogCard(page,id).getByRole('button',{name:'Instalado',exact:true})).toBeDisabled();}
async function docs(page){return page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('ficha-rpg:v2:characters:')&& !key.endsWith(':index'))));}

test('exclusão lista personagens, cancelar preserva e reinstalar não ressuscita fichas @smoke',async({page})=>{
  await ready(page);
  await page.evaluate(async()=>{const systems=await import('/js/repositories/system-repository.js'),characters=await import('/js/repositories/character-repository.js');const pkg=await systems.getSystemPackage('fate-accelerated');const created=await characters.createCharacter(pkg.system);created.name='Fate excluído';await characters.saveCharacter(created);});
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const before=await docs(page);await systems(page);await systemCard(page,'fate-accelerated').getByRole('button',{name:'Excluir sistema',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('1 personagem(ns)');await expect(page.getByRole('dialog')).toContainText('Fate excluído');
  await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();expect(await docs(page)).toEqual(before);
  await deleteUI(page,'fate-accelerated');const remaining=await docs(page);expect(Object.keys(remaining)).toHaveLength(1);expect(Object.values(remaining)[0]).toBe(Object.values(before).find(raw=>JSON.parse(raw).meta.system==='dnd2024'));
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await installUI(page,'fate-accelerated');expect(await docs(page)).toEqual(remaining);
  await systems(page);await expect(systemCard(page,'fate-accelerated')).toBeVisible();
});

test('remover o sistema ativo limpa ficha, dados, sessão e histórico, e permite instalar/criar novamente',async({page})=>{
  await ready(page);await page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true}).fill('Apagar D&D');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');await deleteUI(page,'dnd2024');
  await expect(page.locator('#shell-current-system')).toHaveText('Nenhum sistema');expect(await docs(page)).toEqual({});
  await page.getByRole('button',{name:'Ficha atual',exact:true}).click();await expect(page.locator('#sheet-empty')).toBeVisible();await expect(page.locator('#dnd-sheet-surfaces')).toBeHidden();await expect(page.locator('#btn-export')).toBeDisabled();
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('Nenhum sistema');expect(await docs(page)).toEqual({});
  await installUI(page,'dnd2024');expect(await docs(page)).toEqual({});await systems(page);await systemCard(page,'dnd2024').getByRole('button',{name:'Abrir',exact:true}).click();
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await expect(page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true})).not.toHaveValue('Apagar D&D');
});

test('biblioteca completamente vazia persiste, Novo abre catálogo e instalação funciona offline',async({page,context})=>{
  await ready(page);const ids=await page.evaluate(async()=> (await import('/js/repositories/system-repository.js')).listSystems().map(system=>system.id));
  for(const id of ids)await deleteUI(page,id);
  await expect(page.locator('#systems-list')).toContainText('Nenhum sistema instalado');expect(await docs(page)).toEqual({});
  await context.setOffline(true);await page.reload();await expect(page.locator('#view-catalog')).toBeVisible();await expect(page.locator('#shell-current-system')).toHaveText('Nenhum sistema');
  await page.getByRole('button',{name:'Personagens',exact:true}).click();await page.locator('#btn-library-new-character').click();await expect(page.locator('#view-catalog')).toBeVisible();
  await installUI(page,'dnd2024');await systems(page);await systemCard(page,'dnd2024').getByRole('button',{name:'Abrir',exact:true}).click();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),membership)).toEqual(['dnd2024']);
});

test('pacote próprio é removido em cascata sem tocar nos dados/extras de outros sistemas',async({page})=>{
  await ready(page);const pkg=minimalPackage('catalog-custom');
  await page.evaluate(async pkg=>{const systems=await import('/js/repositories/system-repository.js'),chars=await import('/js/repositories/character-repository.js');await systems.importSystemPackage(new File([JSON.stringify(pkg)],'custom.json'));for(let i=0;i<2;i++)await chars.createCharacter(pkg.system);const other=chars.allCharacters().find(c=>c.meta.system==='dnd2024');other.extras={flag:false,zero:0,empty:'',nullable:null};await chars.saveCharacter(other);},pkg);
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');const before=await docs(page);await deleteUI(page,pkg.system.id);
  const after=await docs(page);expect(Object.keys(after)).toHaveLength(1);const remaining=JSON.parse(Object.values(after)[0]);expect(remaining.extras).toEqual({flag:false,zero:0,empty:'',nullable:null});expect(Object.values(after)[0]).toBe(Object.values(before).find(raw=>JSON.parse(raw).meta.system==='dnd2024'));
  await catalog(page);await expect(catalogCard(page,pkg.system.id)).toHaveCount(0);await page.locator('#input-import-system').setInputFiles({name:'custom.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});await systems(page);await expect(systemCard(page,pkg.system.id)).toBeVisible();expect(await docs(page)).toEqual(after);
});

test('preflight recusa novos vinculados de outra aba sem excluir nada',async({page,context})=>{
  await ready(page);await page.evaluate(async()=>window.removalPlan=await(await import('/js/repositories/system-removal.js')).prepareSystemRemoval('fate-accelerated'));
  const second=await context.newPage();await ready(second);await second.evaluate(async()=>{const pkg=await(await import('/js/repositories/system-repository.js')).getSystemPackage('fate-accelerated');await(await import('/js/repositories/character-repository.js')).createCharacter(pkg.system);});
  const result=await page.evaluate(async()=>{try{await(await import('/js/repositories/system-removal.js')).removeSystem(window.removalPlan);return null;}catch(error){return error.message;}});expect(result).toContain('mudou');
  expect(Object.keys(await docs(page))).toHaveLength(2);expect(await page.evaluate(async()=> (await import('/js/repositories/system-repository.js')).hasSystem('fate-accelerated'))).toBe(true);
});

test('falha na transação reverte pacote, personagens, índice e seleção',async({page})=>{
  await ready(page);const result=await page.evaluate(async()=>{
    const repo=await import('/js/repositories/system-removal.js'),plan=await repo.prepareSystemRemoval('dnd2024');
    const before=Object.fromEntries(Object.entries(localStorage).filter(([key])=>!key.startsWith('ficha-rpg:recovery:'))),remove=Storage.prototype.removeItem;
    Storage.prototype.removeItem=function(key){if(key.startsWith('ficha-rpg:v2:characters:')){Storage.prototype.removeItem=remove;throw new DOMException('Quota','QuotaExceededError');}return remove.call(this,key);};
    try{await repo.removeSystem(plan);return null;}catch(error){return {message:error.message,before,after:Object.fromEntries(Object.entries(localStorage).filter(([key])=>!key.startsWith('ficha-rpg:recovery:')))};}finally{Storage.prototype.removeItem=remove;}
  });expect(result.message).toContain('Falha ao gravar');expect(result.after).toEqual(result.before);
});

test('backup conserva seleção vazia e ID reservado permanece protegido após excluir catálogo',async({page})=>{
  await ready(page);await deleteUI(page,'fate-accelerated');const result=await page.evaluate(async()=>{
    const api=await import('/js/library-backup.js'),systems=await import('/js/repositories/system-repository.js');const backup=api.exportLibrary();
    const removed=!backup.catalogSystems.includes('fate-accelerated');await api.restoreLibrary({...backup,catalogSystems:[],characters:[]},{mode:'replace',confirmed:true});const empty=api.exportLibrary();
    const reserved=await systems.getCatalogPackage('fate-accelerated');let blocked;try{await api.readLibraryBackup(new File([JSON.stringify({...empty,systems:[reserved]})],'backup.json'));}catch(error){blocked=error.message;}
    await api.restoreLibrary(backup,{mode:'merge'});const merged=api.exportLibrary().catalogSystems;const old={...backup};delete old.catalogSystems;old.characters=[structuredClone(reserved.system.characterTemplate)];old.characters[0].meta={...old.characters[0].meta,id:crypto.randomUUID(),system:'fate-accelerated',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await api.restoreLibrary(old,{mode:'merge'});
    return {removed,empty:empty.catalogSystems,blocked,merged,legacy:api.exportLibrary().catalogSystems};
  });expect(result.removed).toBe(true);expect(result.empty).toEqual([]);expect(result.blocked).toContain('ID embutido');expect(result.merged).not.toContain('fate-accelerated');expect(result.legacy).toContain('fate-accelerated');
});

for(const [width,theme] of [[360,'light'],[768,'dark'],[1280,'light']])test(`catálogo ${width}px ${theme}: busca, teclado/toque e dimensões`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await ready(page);if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#btn-theme-toggle').click();await deleteUI(page,'fate-accelerated');await catalog(page);
  await page.locator('#catalog-search').fill('FATE');await expect(page.locator('#catalog-list article')).toHaveCount(1);const button=catalogCard(page,'fate-accelerated').getByRole('button',{name:'Instalar',exact:true});await button.focus();await page.keyboard.press('Enter');await expect(catalogCard(page,'fate-accelerated').getByRole('button',{name:'Instalado',exact:true})).toBeDisabled();
  await page.locator('#catalog-search').fill('sem resultados');await expect(page.locator('#catalog-list')).toContainText('Nenhum sistema encontrado');await page.locator('#catalog-search').fill('');
  const sizes=await page.evaluate(()=>({width:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));expect(sizes.content).toBeLessThanOrEqual(sizes.width);
  await page.screenshot({path:testInfo.outputPath(`catalog-${width}-${theme}.png`),fullPage:false});
});

test('editar pacote instalado mantém ID e personagens, backup conserva edição e reinstalar recupera o original',async({page})=>{
  await ready(page);await deleteUI(page,'fate-accelerated');await installUI(page,'fate-accelerated');await systems(page);
  const before=await docs(page),original=await page.evaluate(async()=> (await import('/js/repositories/system-repository.js')).getCatalogPackage('fate-accelerated'));
  await systemCard(page,'fate-accelerated').getByRole('button',{name:'Editar pacote',exact:true}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');
  const pkg=JSON.parse(await page.locator('#editor-json').inputValue());expect(pkg.system.id).toBe('fate-accelerated');pkg.system.name='Fate da minha mesa';pkg.extras={zero:0,empty:'',flag:false,nullable:null};
  await page.locator('#editor-json').fill(JSON.stringify(pkg,null,2));await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();await expect(page.getByRole('button',{name:'Aplicar pacote',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Aplicar pacote',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar aplicação',exact:true}).click();await expect(page.locator('#editor-application-status')).toContainText('Pacote aplicado');
  expect(await docs(page)).toEqual(before);
  const result=await page.evaluate(async()=>{const systems=await import('/js/repositories/system-repository.js'),backup=await import('/js/library-backup.js');const exported=backup.exportLibrary();await backup.readLibraryBackup(new File([JSON.stringify(exported)],'backup.json'));await backup.restoreLibrary(exported,{mode:'replace',confirmed:true});return {local:await systems.getSystemPackage('fate-accelerated'),base:await systems.getCatalogPackage('fate-accelerated'),count:systems.listSystems().filter(system=>system.id==='fate-accelerated').length};});
  expect(result.local.system.name).toBe('Fate da minha mesa');expect(result.local.extras).toEqual(pkg.extras);expect(result.base).toEqual(original);expect(result.count).toBe(1);
  await page.getByRole('button',{name:'Sair do editor',exact:true}).click();await deleteUI(page,'fate-accelerated');await installUI(page,'fate-accelerated');expect(await page.evaluate(async()=> (await import('/js/repositories/system-repository.js')).getSystemPackage('fate-accelerated'))).toEqual(original);
});

test('sistemas já existentes ganham cópia editável sem alterar base, personagem ou dados fora da instalação',async({page})=>{
  await ready(page);const before=await docs(page);await systems(page);await systemCard(page,'dnd2024').getByRole('button',{name:'Editar pacote',exact:true}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');
  const result=await page.evaluate(async()=>{const repo=await import('/js/repositories/system-repository.js');return {base:await repo.getCatalogPackage('dnd2024'),local:repo.installedPackageBase('dnd2024'),count:repo.listSystems().filter(system=>system.id==='dnd2024').length};});expect(result.base).toEqual(result.local);expect(result.count).toBe(1);expect(await docs(page)).toEqual(before);
});

test('personagens conhecidos corrompidos/futuros são listados na exclusão; dados sem identificação bloqueiam',async({page})=>{
  await ready(page);const known=await page.evaluate(async()=>{const systems=await import('/js/repositories/system-repository.js'),chars=await import('/js/repositories/character-repository.js'),write=await import('/js/write-coordinator.js');const pkg=await systems.getSystemPackage('fate-accelerated');const first=await chars.createCharacter(pkg.system),second=await chars.createCharacter(pkg.system);await write.withLibraryWrite(()=>{localStorage.setItem('ficha-rpg:v2:characters:'+first.meta.id,'{ broken');localStorage.setItem('ficha-rpg:v2:characters:'+second.meta.id,JSON.stringify({...second,schemaVersion:99}));});return [first.meta.id,second.meta.id];});
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await systems(page);await systemCard(page,'fate-accelerated').getByRole('button',{name:'Excluir sistema',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('2 personagem(ns)');await expect(page.getByRole('dialog')).toContainText('indisponível');await page.getByRole('dialog').getByRole('button',{name:'Excluir sistema e personagens',exact:true}).click();await expect(systemCard(page,'fate-accelerated')).toHaveCount(0);
  for(const id of known)expect(await page.evaluate(id=>localStorage.getItem('ficha-rpg:v2:characters:'+id),id)).toBeNull();
  await page.evaluate(()=>localStorage.setItem('ficha-rpg:v2:characters:unknown','{ unknown'));const before=await docs(page);
  expect(await page.evaluate(async()=>{try{await(await import('/js/repositories/system-removal.js')).prepareSystemRemoval('swade');return null;}catch(error){return error.message;}})).toContain('sem identificação');expect(await docs(page)).toEqual(before);
});

test('exclusão em outra aba preserva edição não salva e impede autosave de ressuscitar personagem',async({page,context})=>{
  await ready(page);const second=await context.newPage();await ready(second);
  // Segurar somente o debounce do autosave produz uma edição dirty real e
  // determinística, sem bloquear o coordenador ou a verificação de clientes.
  await second.evaluate(()=>{const timeout=window.setTimeout;window.setTimeout=(callback,delay,...args)=>timeout(callback,delay===300?60000:delay,...args);});
  await second.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true}).fill('Edição removida');
  await page.evaluate(async()=>{const repo=await import('/js/repositories/system-removal.js');await repo.removeSystem(await repo.prepareSystemRemoval('dnd2024'));});
  await expect(second.locator('#removed-context-warning')).toBeVisible();await expect(second.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true})).toHaveValue('Edição removida');
  await second.waitForTimeout(450);expect(await docs(page)).toEqual({});await expect(second.locator('#btn-save-character')).toBeDisabled();
  const download=second.waitForEvent('download');await second.locator('#btn-export-removed').click();expect((await download).suggestedFilename()).toContain('.json');
  await second.locator('#btn-exit-removed').click();await second.getByRole('dialog').getByRole('button',{name:'Sair e descartar'}).click();await expect(second.locator('#shell-current-system')).toHaveText('Nenhum sistema');expect(await docs(second)).toEqual({});
});

test('toque instala e exclui; confirmação cabe em 360px',async({browser},testInfo)=>{
  const context=await browser.newContext({hasTouch:true,viewport:{width:360,height:900}}),page=await context.newPage();
  try{await ready(page);await systems(page);await systemCard(page,'fate-accelerated').getByRole('button',{name:'Excluir sistema'}).tap();await expect(page.getByRole('dialog')).toBeVisible();const rect=await page.getByRole('dialog').boundingBox();expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(361);await page.screenshot({path:testInfo.outputPath('catalog-touch-confirmation.png')});await page.getByRole('dialog').getByRole('button',{name:'Excluir sistema e personagens'}).tap();await expect(systemCard(page,'fate-accelerated')).toHaveCount(0);await page.getByRole('button',{name:'Catálogo',exact:true}).tap();await catalogCard(page,'fate-accelerated').getByRole('button',{name:'Instalar',exact:true}).tap();await expect(catalogCard(page,'fate-accelerated').getByRole('button',{name:'Instalado',exact:true})).toBeDisabled();}
  finally{await context.close();}
});

test('novos itens do manifesto aparecem no catálogo sem instalação automática',async({page})=>{
  await ready(page);const pkg=minimalPackage('future-catalog');const result=await page.evaluate(async pkg=>{
    const repo=await import('/js/repositories/system-repository.js'),originalFetch=window.fetch;
    window.fetch=async(input,...options)=>{
      const url=String(input);
      if(url.endsWith('/future.system.json'))return new Response(JSON.stringify(pkg.system),{status:200});
      if(url.endsWith('/future.layout.json'))return new Response(JSON.stringify(pkg.layouts[0]),{status:200});
      const response=await originalFetch(input,...options);
      if(url.endsWith('/data/systems/index.json')){const manifest=await response.json();manifest.systems.push({id:pkg.system.id,name:pkg.system.name,system:'./future.system.json',layouts:[{id:pkg.layouts[0].id,name:'Padrão',file:'./future.layout.json'}]});return new Response(JSON.stringify(manifest),{status:200});}
      return response;
    };
    try{const initial=repo.listSystems().map(system=>system.id);await repo.initSystemRepository();const before=repo.hasSystem(pkg.system.id),available=repo.listCatalogSystems().some(system=>system.id===pkg.system.id);await repo.installCatalogSystem(pkg.system.id);return {initial,before,available,after:repo.hasSystem(pkg.system.id),local:repo.installedPackageBase(pkg.system.id)};}
    finally{window.fetch=originalFetch;}
  },pkg);expect(result.before).toBe(false);expect(result.available).toBe(true);expect(result.after).toBe(true);expect(result.initial).toHaveLength(8);expect(result.local.system.id).toBe(pkg.system.id);
});

test('cliente antigo bloqueia exclusão e mantém documentos',async({page,context})=>{
  await ready(page);const old=await context.newPage();await old.goto('/test-engine.html');const before=await docs(page);
  expect(await page.evaluate(async()=>{const repo=await import('/js/repositories/system-removal.js');try{await repo.removeSystem(await repo.prepareSystemRemoval('dnd2024'));return null;}catch(error){return error.message;}})).toContain('janela antiga');expect(await docs(page)).toEqual(before);await old.close();
});

test('cliente com trava mas protocolo anterior também bloqueia exclusão',async({page,context})=>{
  await ready(page);const old=await context.newPage();
  await old.addInitScript(()=>navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type==='LIBRARY_WRITE_PROBE' && event.ports[0]){event.stopImmediatePropagation();event.ports[0].postMessage({protocol:1,locks:true});}
  }));await ready(old);const before=await docs(page);
  expect(await page.evaluate(async()=>{const repo=await import('/js/repositories/system-removal.js');try{await repo.removeSystem(await repo.prepareSystemRemoval('dnd2024'));return null;}catch(error){return error.message;}})).toContain('janela antiga');expect(await docs(page)).toEqual(before);await old.close();
});

test('instalação com quota faz rollback e coleção corrompida não é sobrescrita',async({page})=>{
  await ready(page);await deleteUI(page,'fate-accelerated');
  const result=await page.evaluate(async()=>{
    const repo=await import('/js/repositories/system-repository.js'),key='ficha-rpg:v2:catalog-installations',systems='ficha-rpg:v2:systems';
    const before={ids:localStorage.getItem(key),packages:localStorage.getItem(systems)},set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(target,value){if(target===key){Storage.prototype.setItem=set;throw new DOMException('Quota','QuotaExceededError');}return set.call(this,target,value);};
    let failure;try{await repo.installCatalogSystem('fate-accelerated');}catch(error){failure=error.message;}finally{Storage.prototype.setItem=set;}
    const after={ids:localStorage.getItem(key),packages:localStorage.getItem(systems)};
    localStorage.setItem(systems,'{ broken');const errors=[];
    for(const operation of [()=>repo.installCatalogSystem('fate-accelerated'),()=>repo.editableCatalogPackage('dnd2024'),async()=>await(await import('/js/repositories/system-removal.js')).prepareSystemRemoval('dnd2024')]){try{await operation();errors.push(null);}catch(error){errors.push(error.message);}}
    return {before,after,failure,errors,raw:localStorage.getItem(systems),ids:localStorage.getItem(key)};
  });expect(result.failure).toContain('Falha ao gravar');expect(result.after).toEqual(result.before);expect(result.errors.every(message=>message?.includes('inválida'))).toBe(true);expect(result.raw).toBe('{ broken');expect(result.ids).toBe(result.before.ids);
});

test('lista longa na confirmação tem rolagem e botões acessíveis por teclado no celular',async({page},testInfo)=>{
  await page.setViewportSize({width:360,height:560});await ready(page);
  await page.evaluate(async()=>{const repo=await import('/js/repositories/character-repository.js'),pkg=await(await import('/js/repositories/system-repository.js')).getSystemPackage('fate-accelerated');for(let i=0;i<20;i++){const character=await repo.createCharacter(pkg.system);character.identity.name=`Personagem ${i} ${'X'.repeat(320)}`;await repo.saveCharacter(character);}});
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await systems(page);const before=await docs(page);
  await systemCard(page,'fate-accelerated').getByRole('button',{name:'Excluir sistema',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('20 personagem(ns)');
  const bounds=await dialog.boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(15);expect(bounds.y+bounds.height).toBeLessThanOrEqual(545);
  const body=dialog.locator('.modal__body');expect(await body.evaluate(node=>node.scrollHeight>node.clientHeight)).toBe(true);
  const confirm=dialog.getByRole('button',{name:'Excluir sistema e personagens',exact:true}),close=dialog.getByRole('button',{name:'Fechar',exact:true});await close.focus();await page.keyboard.press('Shift+Tab');await expect(confirm).toBeFocused();await page.keyboard.press('Tab');await expect(close).toBeFocused();
  const sizes=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  await page.screenshot({path:testInfo.outputPath('catalog-long-confirmation.png')});await page.keyboard.press('Escape');expect(await docs(page)).toEqual(before);
  await deleteUI(page,'fate-accelerated');expect(Object.keys(await docs(page))).toHaveLength(1);
});

test('seleção corrompida abre configurações para baixar a recuperação sem sobrescrever o original',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ficha-rpg:v2:catalog-installations','{ broken'));await page.goto('/');await expect(page.locator('#view-settings')).toBeVisible();
  const downloaded=page.waitForEvent('download');await page.locator('#btn-export-recovery').click();const file=await downloaded;
  expect(file.suggestedFilename()).toBe('recuperacao-rpg.json');const data=JSON.parse(await readFile(await file.path(),'utf8'));expect(data.entries.some(entry=>entry.key===membership && entry.raw==='{ broken')).toBe(true);expect(await page.evaluate(key=>localStorage.getItem(key),membership)).toBe('{ broken');
});

test('edição de pacote do catálogo em outra aba avisa para reabrir a ficha',async({page,context})=>{
  await ready(page);await systems(page);await systemCard(page,'dnd2024').getByRole('button',{name:'Editar pacote',exact:true}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');
  const before=await docs(page),second=await context.newPage();await ready(second);
  await second.evaluate(async()=>{const repo=await import('/js/repositories/system-repository.js'),pkg=await repo.getSystemPackage('dnd2024');pkg.system.name='D&D da outra aba';await repo.installSystemPackage(repo.prepareSystemInstallation(pkg));});
  await expect(page.locator('.toast').filter({hasText:'reabra a ficha antes de salvar'})).toBeVisible();expect(await docs(page)).toEqual(before);await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});
