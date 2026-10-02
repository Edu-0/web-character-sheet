import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const pkg = (field = 'name') => ({schemaVersion: 1, kind: 'rpg-system-package', system: {schemaVersion: 1, id: 'robust-test', name: 'Sistema de teste', characterTemplate: {schemaVersion: 1, meta: {system: 'robust-test'}, name: 'Ada'}}, layouts: [{schemaVersion: 1, id: 'main', system: 'robust-test', tabs: [{id: 'main', label: 'Principal', sections: [{id: 'main', containers: [{components: [{type: 'text', field, label: 'Nome', default: 'sentinel'}]}]}]}]}]});
const upload = (name, data) => ({name, mimeType: 'application/json', buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))});
test.beforeEach(async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('importação rejeita caminhos perigosos e catálogo interpolado sem poluir protótipos', async ({page}) => {
  for (const field of ['__proto__.__robustTest', 'constructor.prototype.__robustTest', 'prototype.x', 'name..x', '.name']) {
    await page.locator('#input-import-system').setInputFiles(upload('unsafe.json', pkg(field)));
    await expect(page.locator('.toast').last()).toContainText('Caminho inseguro');
  }
  const repeated = pkg('values.{key}');
  repeated.system.catalog = [{key: 'constructor', label: 'Ataque'}];
  repeated.layouts[0].tabs[0].sections[0].containers[0].repeat = {source: 'catalog'};
  await page.locator('#input-import-system').setInputFiles(upload('repeat.json', repeated));
  await expect(page.locator('.toast').last()).toContainText('chave de catálogo');
  expect(await page.evaluate(() => ({ polluted: Object.hasOwn(Object.prototype, '__robustTest'), imported: JSON.parse(localStorage.getItem('ficha-rpg:v2:systems') || '[]').length }))).toEqual({polluted: false, imported: 0});
});

test('personagem com chave reservada ou tipo inválido não deixa documento órfão', async ({page}) => {
  const before = await page.evaluate(() => Object.keys(localStorage).sort());
  await page.locator('#input-import-file').setInputFiles(upload('danger.json', '{"schemaVersion":1,"meta":{"system":"external"},"__proto__":{"polluted":true}}'));
  await expect(page.locator('.toast').last()).toContainText('chave vazia ou reservada');
  const character = await page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get()));
  character.identity.name = 42;
  await page.locator('#input-import-file').setInputFiles(upload('name.json', character));
  await expect(page.locator('.toast').last()).toContainText('identity.name: deve ser texto');
  character.identity.name = 'Nome válido'; character.inventory.items = [{id: 'bad', name: 42}];
  await page.locator('#input-import-file').setInputFiles(upload('item.json', character));
  await expect(page.locator('.toast').last()).toContainText('deve ser texto');
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(before);
});

test('limites recusam bytes antes da leitura e profundidade/coleções/strings com caminho', async ({page}) => {
  const result = await page.evaluate(async () => {
    const {inspectJson, readJsonFile, LIMITS} = await import('/js/validation/limits.js');
    let read = false; let bytes;
    try { await readJsonFile({size: LIMITS.characterBytes + 1, text: async () => {read = true; return '{}';}}, LIMITS.characterBytes, 'character'); } catch (error) {bytes = error.message;}
    let deep = {}; let cursor = deep;
    for (let i = 0; i < 34; i++) { cursor.next = {}; cursor = cursor.next; }
    return {read, bytes, depth: inspectJson(deep, 'character')[0], items: inspectJson({items: Array(10001).fill(0)}, 'character')[0], string: inspectJson({notes: 'x'.repeat(100001)}, 'character')[0], boundary: inspectJson({notes: 'x'.repeat(100000), items: Array(10000).fill(0)}, 'character')};
  });
  expect(result.read).toBe(false); expect(result.bytes).toContain('2 MiB');
  expect(result.depth.path).toContain('character.next'); expect(result.depth.message).toContain('profundidade');
  expect(result.items.path).toBe('character.items'); expect(result.string.path).toBe('character.notes'); expect(result.boundary).toEqual([]);
});

test('helpers não leem herança e rejeitam caminhos vazios/reservados em todas as escritas', async ({page}) => {
  const result = await page.evaluate(async () => {
    const {getByPath,setByPath} = await import('/js/engine/paths.js');
    const errors = [];
    for (const path of ['__proto__.x','constructor.prototype.x','a..b','']) for (const fn of [getByPath,setByPath]) try {fn({},path,1);} catch (error) {errors.push(error.message);}
    const target = Object.create({inherited: 1}); setByPath(target,'own.0.value',9);
    return {errors: errors.length, missingInherited: getByPath(target,'inherited') === undefined, value: getByPath(target,'own.0.value'), polluted: Object.hasOwn(Object.prototype,'x')};
  });
  expect(result).toEqual({errors: 8, missingInherited: true, value: 9, polluted: false});
});

test('fórmulas exigem EOF, whitelist, números finitos e orçamento sem RangeError', async ({page}) => {
  const result = await page.evaluate(async () => {
    const {evaluate} = await import('/js/engine/formula.js');
    const rejected = ['1 2','1.2.3','toString()','constructor()','__proto__.x','1/0','sqrt(-1)','('.repeat(100)+'1'+')'.repeat(100),'1+'.repeat(100)+'1','1'.repeat(4097)];
    return {errors: rejected.map(expression => {try {return {value: evaluate(expression)};} catch (error) {return {name: error.name, message: error.message};}}), valid: evaluate('if(score >= 10, floor((score - 10) / 2), -1)', {vars: {score: 15}}), boolean: evaluate('true && !false')};
  });
  expect(result.errors.every(e => e.message && e.name !== 'RangeError')).toBe(true);
  expect(result.valid).toBe(2); expect(result.boolean).toBe(true);
  const bad = pkg(); bad.system.formulas = {bad: '1 2'};
  await page.locator('#input-import-system').setInputFiles(upload('formula.json',bad));
  await expect(page.locator('.toast').last()).toContainText('system.formulas.bad');
});

test('quota no índice reverte save e exclusão; recarga não cria órfãos', async ({page}) => {
  const result = await page.evaluate(async () => {
    const repo = await import('/js/repositories/character-repository.js');
    const original = Storage.prototype.setItem; const before = repo.listCharacters();
    Storage.prototype.setItem = function(key,value) {if (key === 'ficha-rpg:v2:characters:index') throw new DOMException('quota','QuotaExceededError'); return original.call(this,key,value);};
    const failures = [];
    try {
      try {repo.saveCharacter({schemaVersion:1,meta:{system:'external',id:'failed'},name:'Novo'});} catch(e){failures.push(e.message);}
      try {repo.removeCharacter(before[0].id);} catch(e){failures.push(e.message);}
    } finally {Storage.prototype.setItem = original;}
    return {failures: failures.length, newDocument: repo.getCharacter('failed'), oldDocument: !!repo.getCharacter(before[0].id), journal: localStorage.getItem('ficha-rpg:v2:storage-journal'), index: repo.listCharacters().length};
  });
  expect(result).toEqual({failures: 2, newDocument: null, oldDocument: true, journal: null, index: 1});
  await page.reload(); await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});

test('autosave com quota avisa, mantém memória e exporta mesmo com flush pendente', async ({page}, testInfo) => {
  const errors = []; page.on('pageerror',error => errors.push(error.message));
  await page.evaluate(() => {const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key,value){if(key.startsWith('ficha-rpg:v2:characters:')) throw new DOMException('quota','QuotaExceededError'); return original.call(this,key,value);};});
  const name = page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true});
  await name.fill('Edição protegida');
  await expect(page.locator('#save-indicator')).toContainText('Não salvo');
  await expect(page.locator('.toast').first()).toContainText('exporte');
  await name.fill('Última edição');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#btn-export').click();
  const exported = JSON.parse(await readFile(await (await downloadPromise).path(),'utf8'));
  expect(exported.identity.name).toBe('Última edição'); expect(errors).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('quota-visible.png')});
});

test('corrupção preserva bruto; recuperação continua exportável quando a cota bloqueia cópia', async ({page}) => {
  await page.evaluate(() => localStorage.setItem('ficha-rpg:v2:systems','{broken-json'));
  await page.reload(); await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const result = await page.evaluate(async () => ({raw:localStorage.getItem('ficha-rpg:v2:systems'), recovery:(await import('/js/persistence.js')).recoveryEntries()}));
  expect(result.raw).toBe('{broken-json'); expect(result.recovery.some(e=>e.raw==='{broken-json')).toBe(true);
  const blocked = await page.evaluate(async () => {
    const store = await import('/js/persistence.js'); localStorage.setItem('ficha-rpg:bad-audit','invalid');
    const original = Storage.prototype.setItem; Storage.prototype.setItem = () => {throw new DOMException('quota','QuotaExceededError');};
    try {store.readJson('ficha-rpg:bad-audit',{}); return store.recoveryEntries().some(e=>e.key==='ficha-rpg:bad-audit'&&e.raw==='invalid');}
    finally {Storage.prototype.setItem=original;}
  });
  expect(blocked).toBe(true);
});

test('journal interrompido é revertido na abertura antes de carregar personagem', async ({page}) => {
  const name = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem('ficha-rpg:v2:characters:index')); const key = `ficha-rpg:v2:characters:${index[0].id}`;
    const raw = localStorage.getItem(key); const changed = JSON.parse(raw); changed.identity.name = 'Parcial';
    localStorage.setItem('ficha-rpg:v2:storage-journal',JSON.stringify({schemaVersion:1,before:[[key,raw]]})); localStorage.setItem(key,JSON.stringify(changed));
    return JSON.parse(raw).identity.name;
  });
  await page.reload();
  await expect(page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true})).toHaveValue(name);
  expect(await page.evaluate(()=>localStorage.getItem('ficha-rpg:v2:storage-journal'))).toBeNull();
});

test('substituição de sistema exige confirmação e write falho não muda catálogo em memória', async ({page}) => {
  await page.locator('#input-import-system').setInputFiles(upload('one.json',pkg()));
  await expect(page.locator('.toast').last()).toContainText('importado');
  const next = pkg(); next.system.name = 'Outra versão';
  await page.locator('#input-import-system').setInputFiles(upload('two.json',next));
  await expect(page.getByRole('dialog')).toContainText('Sistema já existente');
  await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(async () => (await import('/js/repositories/system-repository.js')).listSystems().find(s=>s.id==='robust-test').name)).toBe('Sistema de teste');
  const result = await page.evaluate(async next => {
    const repo=await import('/js/repositories/system-repository.js'); const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='ficha-rpg:v2:systems')throw new DOMException('quota','QuotaExceededError');return original.call(this,key,value);};
    try {await repo.importSystemPackage(new File([JSON.stringify(next)],'test.json'),{replace:true});return false;} catch {return repo.listSystems().find(s=>s.id==='robust-test').name==='Sistema de teste';} finally {Storage.prototype.setItem=original;}
  },next);
  expect(result).toBe(true);
});

test('XSS auxiliar e nomes/notas/ajuda importados ficam texto, inclusive na impressão', async ({page}) => {
  const character = JSON.parse(await readFile('data/characters/sistema-rpg.example.character.json','utf8'));
  const html = '<img src=x onerror="window.__xss=1">'; character.name=html; character.origin=html;
  await page.route('**/data/characters/sistema-rpg.example.character.json',route=>route.fulfill({json:character}));
  await page.goto('/test-dice-pool.html');
  await expect(page.locator('#character-summary')).toContainText(html); expect(await page.evaluate(()=>window.__xss)).toBeUndefined(); expect(await page.locator('#character-summary img').count()).toBe(0);
  await page.goto('/'); await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const malicious = pkg(); malicious.system.characterTemplate.name = html; malicious.system.characterTemplate.notes = html;
  malicious.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'textarea',field:'notes',label:html,help:html});
  await page.locator('#input-import-system').setInputFiles(upload('html.json',malicious));
  await page.getByRole('button',{name:'Sistemas',exact:true}).click(); await page.locator('#systems-list .library-card').filter({hasText:'Sistema de teste'}).getByRole('button',{name:'Abrir',exact:true}).click();
  await expect(page.locator('#generic-sheet-host').getByLabel('Nome',{exact:true})).toHaveValue(html);
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root')).toContainText(html); expect(await page.locator('#print-root img').count()).toBe(0); expect(await page.evaluate(()=>window.__xss)).toBeUndefined();
});

test('foco e cursor sobrevivem a atualização externa e mudança em lista', async ({page}) => {
  const name=page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true});
  await name.fill('Aurora'); await name.focus();
  await page.evaluate(async()=>{document.activeElement.setSelectionRange(2,4); (await import('/js/state.js')).state.setPath('identity.player','Jogador');});
  await expect(name).toBeFocused(); expect(await name.evaluate(input=>[input.selectionStart,input.selectionEnd])).toEqual([2,4]);
  await page.keyboard.insertText('XX'); await expect(name).toHaveValue('AuXXra');
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('features',[{id:'focus-entry',name:'Habilidade',description:'Descrição'}]);});
  await page.getByRole('tab',{name:'Habilidades',exact:true}).click();
  await page.locator('[data-entry-id="focus-entry"] summary').click();
  const entryName = page.locator('[data-entry-id="focus-entry"]').getByLabel('Nome',{exact:true});
  await entryName.focus();
  await page.evaluate(async()=>{document.activeElement.setSelectionRange(1,3); (await import('/js/state.js')).state.setPath('features.0.description','Outro texto');});
  await expect(entryName).toBeFocused(); expect(await entryName.evaluate(input=>[input.selectionStart,input.selectionEnd])).toEqual([1,3]);
});

test('upload comprime proporção/peso, rejeita SVG ativo e não busca retrato externo', async ({page}) => {
  const compressed = await page.evaluate(async () => {
    const canvas=document.createElement('canvas'); canvas.width=2048; canvas.height=1024; const context=canvas.getContext('2d'); context.fillStyle='red'; context.fillRect(0,0,2048,1024);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')); const {compressPortrait}=await import('/js/images.js'); const data=await compressPortrait(new File([blob],'portrait.png',{type:'image/png'})); const image=new Image(); image.src=data; await image.decode();
    return {width:image.naturalWidth,height:image.naturalHeight,size:atob(data.split(',')[1]).length,format:data.split(';')[0]};
  });
  expect(compressed.width).toBe(1024); expect(compressed.height).toBe(512); expect(compressed.size).toBeLessThanOrEqual(300*1024); expect(compressed.format).toBe('data:image/webp');
  await page.locator('#generic-sheet-host .engine-image input[type=file]').setInputFiles({name:'active.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')});
  await expect(page.locator('.toast').last()).toContainText('não permitido');
  const requests=[]; page.on('request',r=>{if(r.url().includes('external.invalid'))requests.push(r.url());});
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('identity.portrait','https://external.invalid/track.png');});
  await expect(page.locator('.engine-image__placeholder')).toContainText('externo preservado'); expect(requests).toEqual([]);
});

test('backup UI exporta tudo; cancelar preserva e mesclar não substitui conflitos', async ({page}) => {
  await page.locator('#generic-sheet-host').getByLabel('Nome do personagem',{exact:true}).fill('Meu personagem');
  await page.getByRole('button',{name:'Configurações',exact:true}).click();
  const downloading=page.waitForEvent('download'); await page.locator('#btn-export-library').click();
  const data=JSON.parse(await readFile(await (await downloading).path(),'utf8'));
  expect(data.kind).toBe('rpg-library-backup'); expect(data.characters[0].identity.name).toBe('Meu personagem'); expect(data.preferences).toHaveProperty('theme');
  data.characters[0].identity.name='Conflito'; const other=structuredClone(data.characters[0]); other.meta.id='backup-new'; other.identity.name='Outra ficha'; data.characters.push(other);
  await page.locator('#input-import-library').setInputFiles(upload('backup.json',data));
  await expect(page.getByRole('dialog')).toContainText('Conflitos: 1'); await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(async()=>(await import('/js/repositories/character-repository.js')).listCharacters().length)).toBe(1);
  await page.locator('#input-import-library').setInputFiles(upload('backup.json',data)); await page.getByRole('dialog').getByRole('button',{name:'Restaurar',exact:true}).click();
  await expect(page.locator('.toast').last()).toContainText('Biblioteca restaurada');
  const result=await page.evaluate(async()=>(await import('/js/repositories/character-repository.js')).listCharacters().map(c=>c.name)); expect(result).toContain('Meu personagem'); expect(result).toContain('Outra ficha'); expect(result).not.toContain('Conflito');
  await page.reload(); await expect(page.locator('#shell-current-character')).toHaveText('Meu personagem');
});

test('backup substitui com confirmação/pré-backup; quota reverte todos os writes', async ({page}) => {
  const data=await page.evaluate(async()=>(await import('/js/library-backup.js')).exportLibrary((await import('/js/state.js')).state.get()));
  data.characters[0].identity.name='Restaurado';
  await page.getByRole('button',{name:'Configurações',exact:true}).click();
  await page.locator('#input-import-library').setInputFiles(upload('backup.json',data)); await page.locator('#backup-restore-mode').selectOption('replace'); await page.getByRole('dialog').getByRole('button',{name:'Restaurar',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Confirmar restauração'); await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(async()=>(await import('/js/state.js')).state.get().identity.name)).not.toBe('Restaurado');
  await page.locator('#input-import-library').setInputFiles(upload('backup.json',data)); await page.locator('#backup-restore-mode').selectOption('replace'); await page.getByRole('dialog').getByRole('button',{name:'Restaurar',exact:true}).click();
  const download=page.waitForEvent('download'); await page.getByRole('dialog').getByRole('button',{name:'Substituir dados',exact:true}).click(); expect((await download).suggestedFilename()).toContain('antes-restauracao');
  await expect(page.locator('#shell-current-character')).toHaveText('Restaurado');
  const rollback=await page.evaluate(async()=>{
    const backup=await import('/js/library-backup.js'); const before=backup.exportLibrary(); const changed=structuredClone(before); changed.characters[0].identity.name='Parcial'; changed.preferences.theme = before.preferences.theme === 'dark' ? 'light' : 'dark';
    const original=Storage.prototype.setItem; Storage.prototype.setItem=function(key,value){if(key==='ficha-rpg:settings')throw new DOMException('quota','QuotaExceededError');return original.call(this,key,value);};
    try {await backup.restoreLibrary(changed,{mode:'replace',confirmed:true});return false;} catch {return backup.exportLibrary().characters[0].identity.name==='Restaurado';} finally {Storage.prototype.setItem=original;}
  });
  expect(rollback).toBe(true);
});

test('backup rejeita estrutura inválida antes de escrever e roundtrip conserva sistemas e órfãos', async ({page}) => {
  const result=await page.evaluate(async packageData=>{
    const repo=await import('/js/repositories/system-repository.js'); await repo.importSystemPackage(new File([JSON.stringify(packageData)],'system.json'));
    const chars=await import('/js/repositories/character-repository.js'); chars.saveCharacter({schemaVersion:1,meta:{system:'missing',id:'orphan'},name:'Órfão'});
    const backup=await import('/js/library-backup.js'); const before=backup.exportLibrary(); const bad=structuredClone(before); bad.characters.find(character => character.identity).identity.name=42; let rejected=false;
    try {await backup.restoreLibrary(bad,{mode:'replace',confirmed:true});}catch {rejected=true;}
    await backup.restoreLibrary(before,{mode:'replace',confirmed:true}); const after=backup.exportLibrary();
    return {rejected,systems:after.systems.length,characters:after.characters.length,orphan:after.characters.some(c=>c.meta.id==='orphan'),same:JSON.stringify(before.characters)===JSON.stringify(after.characters)};
  },pkg());
  expect(result).toEqual({rejected:true,systems:1,characters:2,orphan:true,same:true});
});

for (const theme of ['light','dark']) test(`muitas entradas e nome sem espaços cabem; backup responsivo em ${theme}`, async ({page},testInfo)=>{
  await page.setViewportSize({width:360,height:900});
  await page.evaluate(async theme=>{(await import('/js/theme.js')).applyTheme(theme); const {state}=await import('/js/state.js');state.setPath('identity.name','N'.repeat(1000)); state.setPath('features',Array.from({length:120},(_,i)=>({id:`stress-${i}`,name:`Entrada${i}`.repeat(8),description:'Texto longo '.repeat(40)})));},theme);
  await page.getByRole('tab',{name:'Habilidades',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Configurações',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`backup-${theme}-360.png`),fullPage:true});
});

test('backup próprio preserva profundidade válida, retrato legado grande e chaves de recuperação com ponto', async ({page}) => {
  const result = await page.evaluate(async packageData => {
    let current = packageData;
    for (let i = 0; i < 31; i++) { current.extension = {}; current = current.extension; }
    current.value = 1;
    const systems = await import('/js/repositories/system-repository.js');
    await systems.importSystemPackage(new File([JSON.stringify(packageData)], 'deep.json'));
    const character = structuredClone((await import('/js/state.js')).state.get());
    character.identity.portrait = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 ** 2);
    const library = await import('/js/library-backup.js');
    const data = library.exportLibrary(character);
    data.recovery = [{key: 'ficha-rpg:v2:characters:id.with.dot', raw: '{broken', recoveredAt: new Date().toISOString()}];
    const parsed = await library.readLibraryBackup(new File([JSON.stringify(data)], 'own-backup.json'));
    // Volta de leitura é suficiente para checar os limites sem ocupar a cota com a imagem fictícia.
    return {portrait: parsed.characters.find(c => c.meta.id === character.meta.id).identity.portrait === character.identity.portrait, recovery: parsed.recovery[0].key, systems: parsed.systems.length};
  }, pkg());
  expect(result).toEqual({portrait: true, recovery: 'ficha-rpg:v2:characters:id.with.dot', systems: 1});
});
