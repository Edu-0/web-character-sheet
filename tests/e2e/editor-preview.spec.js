import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {minimalPackage} from '../../js/editor/minimal-package.js';
const read=name=>JSON.parse(readFileSync(`data/examples/${name}.package.json`,'utf8'));
async function start(page) {
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.getByRole('button',{name:'Comparar lado a lado'}).click();
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.evaluate(async()=>{
    window.realEvents=0;for(const event of ['sheet:rolled','dnd:rolled'])document.addEventListener(event,()=>window.realEvents++);
    const node=document.createElement('div');node.id='isolation-host';document.body.append(node);
    window.preview=new (await import('/js/editor/preview-host.js')).PreviewHost(node);
  });
}
async function mount(page,pkg,layoutId=pkg.layouts[0].id) {
  await page.evaluate(async ({pkg,layoutId})=>window.preview.mount(pkg,{revision:1,layoutId}),{pkg,layoutId});
  const frame=page.frameLocator('#isolation-host iframe:not([hidden])');
  await page.locator('#isolation-host iframe:not([hidden])').evaluate(el=>{el.style.width='100%';el.style.height='850px';});return frame;
}
async function real(page) {return page.evaluate(async()=>({
  storage:Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('ficha-rpg:') && !key.startsWith('ficha-rpg:editor:'))),
  character:structuredClone((await import('/js/state.js')).state.get()),system:(await import('/js/engine/system.js')).getSystem(),layout:(await import('/js/engine/layout.js')).getLayout(),
  history:structuredClone((await import('/js/dice.js')).getHistory()),edits:(await import('/js/state.js')).state.historyStatus(),events:window.realEvents,
}));}
const snapshot=page=>page.evaluate(()=>window.preview.snapshot());
test('origem opaca: defaults, input, fórmula, overrides, eventos e mensagens falsas isolados',async({page})=>{
  await start(page);const before=await real(page),pkg=minimalPackage('preview-proof');
  pkg.system.characterTemplate.sentinels={null:null,zero:0,off:false,empty:''};
  const components=pkg.layouts[0].tabs[0].sections[0].containers[0].components;
  components.push({type:'number',field:'missing',default:7,label:'Ausente'},{type:'number',field:'sentinels.null',default:8,label:'Nulo'},{type:'number',field:'sentinels.zero',default:9,label:'Zero'},{type:'boolean',field:'sentinels.off',default:true,label:'Falso'},{type:'text',field:'sentinels.empty',default:'default',label:'Vazio'});
  const frame=await mount(page,pkg);await expect(frame.getByLabel('Ausente',{exact:true})).toHaveValue('7');await expect(frame.getByLabel('Zero',{exact:true})).toHaveValue('0');await expect(frame.getByLabel('Falso',{exact:true})).not.toBeChecked();await expect(frame.getByLabel('Vazio',{exact:true})).toHaveValue('');
  await frame.getByLabel('Base',{exact:true}).fill('11');await expect(frame.locator('.engine-computed__value')).toContainText('12');
  await frame.locator('.engine-calculation-control summary').click();await frame.getByLabel(/Modo de cálculo/).selectOption('fixed');await frame.getByLabel(/Valor manual/).fill('42');await expect(frame.locator('.engine-computed__value')).toContainText('42');expect((await snapshot(page)).character.calculationOverrides).toBeTruthy();
  const isolation=await frame.locator('body').evaluate(()=>{
    const blocked={};for(const [key,fn] of Object.entries({parent:()=>parent.document.body,storage:()=>localStorage.getItem('x')})) {try{fn();blocked[key]=false;}catch{blocked[key]=true;}}return blocked;
  });expect(isolation).toEqual({parent:true,storage:true});
  await page.evaluate(()=>{window.postMessage({type:'rendered',protocol:1,sessionId:'false',generation:1,revision:1,layoutId:'default'},'*');window.preview.current.frame.contentWindow.postMessage({type:'mount',protocol:1,package:{}},'*');});
  expect((await snapshot(page)).character.score).toBe(11);
  await page.waitForTimeout(650);expect(await real(page)).toEqual(before);
  await page.evaluate(()=>window.preview.dispose());await expect(page.locator('#isolation-host iframe')).toHaveCount(0);
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');expect((await real(page)).character).toEqual(before.character);
});
test('CSP nega rede e HTML do pacote; runtime local funciona offline',async({page,context})=>{
  await start(page);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await context.setOffline(true);await start(page);
  const pkg=minimalPackage('offline-proof');pkg.system.characterTemplate.identity.name='</script><img src=x onerror="parent.bad=true">';
  const frame=await mount(page,pkg);await expect(frame.getByLabel('Nome',{exact:true})).toHaveValue(pkg.system.characterTemplate.identity.name);
  expect(await frame.locator('body').evaluate(async()=>{try{await fetch('https://example.com');return false;}catch{return true;}})).toBe(true);
  expect(await page.evaluate(()=>window.bad || false)).toBe(false);
});
test('rolagem com custo e modal funciona no frame; fechamento cancela contexto e autosave',async({page})=>{
  await start(page);const before=await real(page),frame=await mount(page,read('generic-entry-rolls'));
  await frame.getByRole('button',{name:'Ativar poder',exact:true}).click();
  const dialog=frame.getByRole('dialog');await dialog.getByLabel('Consumir energia').check();await dialog.getByRole('button',{name:'Ativar',exact:true}).click();
  const sample=await snapshot(page);expect(sample.character.energy).toBe(3);expect(sample.history.length).toBeGreaterThan(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(frame.getByRole('dialog')).toBeVisible();
  await page.evaluate(()=>window.preview.dispose());await page.waitForTimeout(650);expect(await real(page)).toEqual(before);
});
test('efeito/migração efêmera e teste corretos, sem recovery/save real',async({page})=>{
  await start(page);const before=await real(page);
  const pkg=await page.evaluate(async()=>{const pkg=await(await import('/js/repositories/system-repository.js')).getSystemPackage('swade');pkg.system.characterTemplate.schemaVersion=1;delete pkg.system.characterTemplate.activeEffects;return pkg;});
  const frame=await mount(page,pkg,'swade-table');await frame.getByRole('button',{name:'Ativar Coringa',exact:true}).click();
  await expect(frame.getByRole('dialog')).toContainText('somente no ensaio');await frame.getByRole('button',{name:'Migrar e ativar',exact:true}).click();
  await expect(frame.locator('.engine-effects')).toContainText('Coringa · Ativo');
  await frame.getByRole('button',{name:'Rolar teste',exact:true}).first().click();
  let sample=await snapshot(page);expect(sample.character.schemaVersion).toBe(2);expect(sample.migrationOriginal.schemaVersion).toBe(1);expect(sample.history.length).toBe(1);expect(sample.history[0].snapshot.effects.value).toBe(2);
  await frame.getByRole('button',{name:'Confirmar fim de rodada'}).click();await frame.getByRole('button',{name:'Confirmar evento',exact:true}).click();
  sample=await snapshot(page);expect(sample.character.activeEffects[0].status).toBe('expired');
  await page.waitForTimeout(650);expect(await real(page)).toEqual(before);
});
test('D&D ensaia recuperação com seus globals enquanto ficha real é outro sistema',async({page})=>{
  await start(page);await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.locator('#systems-list .library-card').filter({hasText:'Fate Acelerado'}).getByRole('button',{name:'Abrir',exact:true}).click();await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:v2:app-session')).currentSystemId)).toBe('fate-accelerated');
  const before=await real(page),pkg=await page.evaluate(async()=>{const pkg=await(await import('/js/repositories/system-repository.js')).getSystemPackage('dnd2024');Object.assign(pkg.system.characterTemplate.combat,{hpCurrent:1,hpMax:20});return pkg;});
  const frame=await mount(page,pkg);await frame.getByRole('button',{name:'Descanso longo',exact:true}).click();const dialog=frame.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Aplicar recuperação'}).click();
  expect((await snapshot(page)).character.combat.hpCurrent).toBe(20);await page.waitForTimeout(650);expect(await real(page)).toEqual(before);
});
test('progressão, ações e modal descartado não alcançam a ficha D&D',async({page})=>{
  await start(page);const before=await real(page),pkg=await page.evaluate(async()=>await(await import('/js/repositories/system-repository.js')).getSystemPackage('sistema-rpg'));
  const frame=await mount(page,pkg);await frame.getByRole('tab',{name:'Progressão',exact:true}).click();
  await frame.getByRole('button',{name:'Concluir criação',exact:true}).click();expect((await snapshot(page)).character.progression.creation).toBeTruthy();
  await frame.getByRole('tab',{name:'Recursos',exact:true}).click();await frame.getByRole('button',{name:'Descanso longo',exact:true}).click();
  expect((await snapshot(page)).character.scene.lastAction).toBeTruthy();
  await page.evaluate(()=>window.preview.dispose());await page.waitForTimeout(650);expect(await real(page)).toEqual(before);
});
