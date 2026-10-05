import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const buttons=()=>read('data/examples/check-buttons.package.json');
const upload=data=>({name:'regression.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
function effectsPackage() {
  const pkg=buttons();pkg.system.schemaVersion=2;pkg.system.characterTemplate.schemaVersion=2;
  pkg.system.effectDefinitions=[{id:'demo',label:'Demonstração',revision:1,stacking:'unique',applicability:'always',duration:{type:'untilEvent',event:'endRound'},operations:[{type:'add',target:{kind:'checkModifier',key:'action',unit:'total'},value:2}]}];
  pkg.system.characterTemplate.activeEffects=[];
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'effectList'});
  return pkg;
}
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');});

test('R2: mescla recusa reinterpretação de efeitos sem gravar; replace restaura snapshot coerente',async({page})=>{
  const result=await page.evaluate(async pkg=>{
    const systems=await import('/js/repositories/system-repository.js'),chars=await import('/js/repositories/character-repository.js');
    const {activateEffect,effectContribution}=await import('/js/engine/effects.js');
    const {restoreLibrary,exportLibrary}=await import('/js/library-backup.js');
    const file=value=>new File([JSON.stringify(value)],'fixture.json',{type:'application/json'});
    const snapshot=()=>JSON.stringify(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
    await systems.importSystemPackage(file(pkg));const c=chars.createCharacter(pkg.system);
    c.extra={zero:0,off:false};activateEffect(c,pkg.system,'demo','one');chars.saveCharacter(c);
    const coherent=exportLibrary();
    const changed=structuredClone(pkg);changed.system.effectDefinitions[0].operations[0].value=99;
    const backup={schemaVersion:2,kind:'rpg-library-backup',systems:[changed],characters:[],preferences:{}};
    const attempts=[];
    async function blocked(action) {const before=snapshot();try{await action();attempts.push({blocked:false});}catch(error){attempts.push({blocked:true,same:before===snapshot(),message:error.message});}}
    await blocked(()=>restoreLibrary(backup,{overwriteConflicts:true,confirmed:true,currentCharacter:c}));
    const incoming=structuredClone(c);incoming.meta.id='incoming';backup.characters=[incoming];
    await blocked(()=>restoreLibrary(backup)); // pacote preservado também não pode reinterpretar a entrada nova
    backup.characters=[];changed.system.effectDefinitions[0].revision=2;
    await blocked(()=>restoreLibrary(backup,{overwriteConflicts:true,confirmed:true})); // instância local ainda ativa na revisão 1
    const bonus=effectContribution(chars.getCharacter(c.meta.id),(await systems.getSystemPackage(pkg.system.id)).system,{kind:'checkModifier',key:'action',unit:'total'}).value;
    const ignored=structuredClone(backup);ignored.systems[0].system.effectDefinitions[0].revision=1;
    await restoreLibrary(ignored); // pacote conflitante ignorado e sem personagem novo: sem substituição
    c.activeEffects[0].status='inactive';chars.saveCharacter(c);
    await restoreLibrary(backup,{overwriteConflicts:true,confirmed:true});
    const revisionAfterMerge=(await systems.getSystemPackage(pkg.system.id)).system.effectDefinitions[0].revision;
    await restoreLibrary(coherent,{mode:'replace',confirmed:true});
    return {attempts,bonus,revisionAfterMerge,restored:chars.getCharacter(c.meta.id),system:(await systems.getSystemPackage(pkg.system.id)).system};
  },effectsPackage());
  expect(result.attempts).toHaveLength(3);
  for(const attempt of result.attempts){expect(attempt.blocked,attempt.message).toBe(true);expect(attempt.same).toBe(true);}
  expect(result.bonus).toBe(2);expect(result.revisionAfterMerge).toBe(2);
  expect(result.system.effectDefinitions[0].revision).toBe(1);expect(result.system.effectDefinitions[0].operations[0].value).toBe(2);
  expect(result.restored.activeEffects[0].status).toBe('active');expect(result.restored.extra).toEqual({zero:0,off:false});
  await page.reload();
  expect(await page.evaluate(async id=>(await import('/js/repositories/character-repository.js')).getCharacter(id).activeEffects[0].status,result.restored.meta.id)).toBe('active');
});

test('R3: importações conflitantes/futuras e migrações canceladas preservam toda a biblioteca',async({page})=>{
  const pkg=read('data/examples/generic-entry-rolls.package.json');
  const result=await page.evaluate(async pkg=>{
    const systems=await import('/js/repositories/system-repository.js'),chars=await import('/js/repositories/character-repository.js');
    const file=value=>new File([JSON.stringify(value)],'fixture.json',{type:'application/json'});
    const snapshot=()=>JSON.stringify(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
    await systems.importSystemPackage(file(pkg));
    const results=[];
    for(const normalize of [false,true]) {
      const c=structuredClone(pkg.system.characterTemplate);c.techniques[0].rollOptions={attack:false,checkEnabled:true};
      const bad=structuredClone(pkg);bad.system.entryRolls.skillCheck.test={...bad.system.entryRolls.skillCheck.check,enabled:false};
      for(const [value,importer] of [[c,chars.importCharacter],[bad,systems.importSystemPackage]]) {
        const before=snapshot();let confirmations=0;
        try{await importer(file(value),{replace:true,...(normalize?{confirmMigration:()=>{confirmations++;return true;}}:{})});results.push({blocked:false});}
        catch(error){results.push({blocked:true,same:before===snapshot(),confirmations,message:error.message});}
      }
    }
    const c=structuredClone(pkg.system.characterTemplate);c.schemaVersion=99;
    const before=snapshot();try{await chars.importCharacter(file(c),{confirmMigration:()=>true});results.push({blocked:false});}
    catch(error){results.push({blocked:true,same:before===snapshot(),confirmations:0,message:error.message});}
    c.schemaVersion=1;c.techniques[0].rollOptions={attack:false};let cancelled=false,asked=0;
    try{await chars.importCharacter(file(c),{confirmMigration:()=>{asked++;return false;}});}catch(error){cancelled=/cancelada/.test(error.message);}
    return {results,cancelled,asked,same:before===snapshot()};
  },pkg);
  for(const attempt of result.results){expect(attempt.blocked,attempt.message).toBe(true);expect(attempt.same).toBe(true);expect(attempt.confirmations).toBe(0);}
  expect(result.cancelled).toBe(true);expect(result.asked).toBe(1);expect(result.same).toBe(true);
});

test('R4: botão da entrada com ID 0 e painel legado selecionam perícias diferentes',async({page})=>{
  const pkg=buttons();
  await page.locator('#input-import-system').setInputFiles(upload(pkg));await expect(page.locator('.toast').last()).toContainText('importado');
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.locator('#systems-list .library-card').filter({hasText:pkg.system.name}).getByRole('button',{name:'Abrir',exact:true}).click();
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('skills',[{name:'Legado',rating:1},{id:'0',name:'Explícito',rating:5}]);crypto.getRandomValues=array=>array.fill(0x80000000);});
  await page.getByLabel('Base',{exact:true}).fill('3');
  const entry=page.locator('.engine-entry').filter({hasText:'Explícito'});if(await entry.getAttribute('open')===null) await entry.locator('summary').click();
  await entry.getByRole('button',{name:'Rolar Explícito',exact:true}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('Fonte do teste')).toHaveValue(JSON.stringify(['skill','id','0']));
  await dialog.getByRole('button',{name:'Rolar teste',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Explícito: 5');
  await page.keyboard.press('Escape');
  const panel=page.locator('#generic-sheet-host .engine-check');
  await panel.getByLabel('Fonte do teste').selectOption({label:'Perícia: Legado (1)'});
  await panel.getByRole('button',{name:'Rolar teste',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Legado: 1');
});

test('R5/R6: template inválido não entra; substituição conserva instância encerrada e duração antiga',async({page})=>{
  const result=await page.evaluate(async pkg=>{
    const systems=await import('/js/repositories/system-repository.js'),chars=await import('/js/repositories/character-repository.js');
    const {activateEffect}=await import('/js/engine/effects.js');const file=value=>new File([JSON.stringify(value)],'fixture.json');
    const invalid=structuredClone(pkg);activateEffect(invalid.system.characterTemplate,invalid.system,'demo','one');
    invalid.system.characterTemplate.activeEffects[0].definitionId='missing';const before=localStorage.getItem('ficha-rpg:v2:systems');let rejected=false;
    try{await systems.importSystemPackage(file(invalid));}catch{rejected=true;}
    const same=before===localStorage.getItem('ficha-rpg:v2:systems');
    await systems.importSystemPackage(file(pkg));const c=chars.createCharacter(pkg.system);activateEffect(c,pkg.system,'demo','old');c.activeEffects[0].status='expired';c.activeEffects[0].extra={keep:42};chars.saveCharacter(c);
    const original=structuredClone(c.activeEffects);pkg.system.effectDefinitions[0].revision=2;pkg.system.effectDefinitions[0].duration={type:'manual'};
    await systems.importSystemPackage(file(pkg),{replace:true});
    return {rejected,same,original,stored:chars.getCharacter(c.meta.id).activeEffects,id:c.meta.id};
  },effectsPackage());
  expect(result.rejected).toBe(true);expect(result.same).toBe(true);expect(result.stored).toEqual(result.original);
  await page.reload();expect(await page.evaluate(async id=>(await import('/js/repositories/character-repository.js')).getCharacter(id).activeEffects,result.id)).toEqual(result.original);
});

test('R7: pointBudget sem configFrom importa e renderiza o default compartilhado',async({page})=>{
  const pkg=buttons();pkg.system.pointBudget={sources:[],field:'progression',qualityField:'quality',adjustmentField:'adjustment',evolutionField:'evolution'};
  pkg.system.qualityPresets=[{id:'demo',points:12}];pkg.system.characterTemplate.quality='demo';
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'pointBudget',label:'Pontos'});
  await page.locator('#input-import-system').setInputFiles(upload(pkg));await expect(page.locator('.toast').last()).toContainText('importado');
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.locator('#systems-list .library-card').filter({hasText:pkg.system.name}).getByRole('button',{name:'Abrir',exact:true}).click();
  await expect(page.locator('.engine-budget')).toBeVisible();
  await expect(page.locator('.engine-budget').getByLabel('Pontos de criação',{exact:true})).toHaveText('12');
});
