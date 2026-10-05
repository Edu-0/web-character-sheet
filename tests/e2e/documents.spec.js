import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const example=JSON.parse(readFileSync('data/examples/check-rolls.package.json','utf8'));
const upload=data=>({name:'contract.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');});
test('metadados não reconhecidos do envelope de backup sobrevivem restaurar e reexportar',async({page})=>{
  const result=await page.evaluate(async()=>{
    const backup=await import('/js/library-backup.js');const data=backup.exportLibrary();data.extra={zero:0,off:false,list:['preservar']};
    await backup.restoreLibrary(data);return backup.exportLibrary().extra;
  });expect(result).toEqual({zero:0,off:false,list:['preservar']});
});

test('referência inválida informa caminho e substituição incompatível conserva pacote e personagem @smoke',async({page})=>{
  const bad=structuredClone(example);bad.layouts[0].tabs[0].sections[0].containers[0].repeat={source:'missing'};
  await page.locator('#input-import-system').setInputFiles(upload(bad));
  await expect(page.locator('.toast').last()).toContainText('repeat.source');
  await page.locator('#input-import-system').setInputFiles(upload(example));
  await expect(page.locator('.toast').last()).toContainText('importado');
  const result=await page.evaluate(async pkg=>{
    const systems=await import('/js/repositories/system-repository.js'), chars=await import('/js/repositories/character-repository.js');
    const c=chars.createCharacter(pkg.system); c.score=4;chars.saveCharacter(c);
    const before=localStorage.getItem('ficha-rpg:v2:systems');
    pkg.system.characterTemplate.score='base';
    pkg.system.checks.action.sources=pkg.system.checks.action.sources.filter(source=>source.field!=='score');
    pkg.layouts[0].tabs[0].sections[0].containers[0].components.unshift({type:'text',field:'score',label:'Incompatível'});
    try{await systems.importSystemPackage(new File([JSON.stringify(pkg)],'bad.json'),{replace:true});return {blocked:false};}
    catch(error){return {blocked:true,message:error.message,same:before===localStorage.getItem('ficha-rpg:v2:systems'),score:chars.getCharacter(c.meta.id).score};}
  },example);
  expect(result.blocked).toBe(true);expect(result.same).toBe(true);expect(result.score).toBe(4);
});

test('pacote indisponível não oculta pacote válido; documento futuro fica protegido e exportável',async({page})=>{
  await page.evaluate(pkg=>{
    const future=structuredClone(pkg);future.system.id='future';future.system.name='Sistema futuro';future.schemaVersion=99;
    localStorage.setItem('ficha-rpg:v2:systems',JSON.stringify([pkg,future]));
    localStorage.setItem('ficha-rpg:v2:characters:future-character',JSON.stringify({schemaVersion:99,meta:{id:'future-character',system:'future'},name:'Personagem futuro',extra:{keep:42}}));
  },example);
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();
  await expect(page.locator('#systems-list .library-card').filter({hasText:example.system.name}).getByRole('button',{name:'Abrir',exact:true})).toBeEnabled();
  await expect(page.locator('#systems-list .library-card').filter({hasText:'Sistema futuro'}).getByRole('button',{name:'Abrir',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Personagens',exact:true}).click();
  const card=page.locator('#characters-list .library-card').filter({hasText:'Personagem futuro'});
  await expect(card.getByRole('button',{name:'Abrir',exact:true})).toBeDisabled();
  const download=page.waitForEvent('download');await card.getByRole('button',{name:'Exportar',exact:true}).click();await download;
  expect(await page.evaluate(async()=>{
    const repo=await import('/js/repositories/character-repository.js');
    try{repo.saveCharacter({schemaVersion:1,meta:{id:'future-character',system:'external'},name:'Overwrite'});return false;}catch{return JSON.parse(repo.rawCharacter('future-character')).schemaVersion===99;}
  })).toBe(true);
});

test('migração confirmada conserva original recuperável e propriedades extras',async({page})=>{
  const pkg=JSON.parse(readFileSync('data/examples/generic-entry-rolls.package.json','utf8'));
  await page.locator('#input-import-system').setInputFiles(upload(pkg));
  await expect(page.locator('.toast').last()).toContainText('importado');
  const original=structuredClone(pkg.system.characterTemplate);original.name='Migração';original.extra={keep:42};
  original.extensions={rollOptions:{attack:false,upcast:'metadado opaco'}};
  original.techniques[0].rollOptions={attack:false,attackModifier:'0',extensions:{keep:12}};
  await page.locator('#input-import-file').setInputFiles(upload(original));
  await expect(page.getByRole('dialog')).toContainText('Revisar migração');
  await page.getByRole('dialog').getByRole('button',{name:'Migrar e importar',exact:true}).click();
  await expect(page.locator('#characters-list')).toContainText('Migração');
  const result=await page.evaluate(async()=>({characters:(await import('/js/repositories/character-repository.js')).allCharacters(),recovery:(await import('/js/persistence.js')).recoveryEntries()}));
  const migrated=result.characters.find(c=>c.name==='Migração');
  expect(migrated.extra).toEqual({keep:42});expect(migrated.extensions).toEqual(original.extensions);
  expect(migrated.techniques[0].rollOptions).toEqual({checkEnabled:false,modifier:'0',extensions:{keep:12}});
  expect(result.recovery.some(e=>JSON.parse(e.raw).techniques?.[0]?.rollOptions?.attack===false)).toBe(true);
});
