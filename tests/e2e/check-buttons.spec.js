import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('data/examples/check-buttons.package.json','utf8'));
async function open(page){
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.locator('#input-import-system').setInputFiles({name:'buttons.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.locator('#systems-list .library-card').filter({hasText:pkg.system.name}).getByRole('button',{name:'Abrir',exact:true}).click();
  await page.evaluate(()=>{crypto.getRandomValues = array => array.fill(Math.floor(0.5 * 0x100000000));});
}
test('campo e painel usam fonte calculada ajustada, snapshot e foco sem editar personagem @smoke',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('calculationOverrides',{'computed.shared':{mode:'adjust',value:2}});});
  const button=page.getByRole('button',{name:'Rolar Total ajustado',exact:true});await button.click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Fonte do teste')).toHaveValue('derived');
  await dialog.getByRole('button',{name:'Rolar teste',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Total ajustado: 5');
  const history=await page.evaluate(async()=>structuredClone((await import('/js/dice.js')).getHistory()[0]));expect(history.snapshot.options.value).toBe(5);expect(history.resolution.outcome).toBe('Sucesso com estilo');
  await dialog.locator('.modal__footer button').focus();await page.keyboard.press('Tab');await expect(dialog.locator('.modal__close')).toBeFocused();
  await page.keyboard.press('Escape');await expect(button).toBeFocused();
  const check=page.locator('#generic-sheet-host .engine-check');await check.getByLabel('Fonte do teste').selectOption('derived');await check.getByRole('button',{name:'Rolar teste',exact:true}).click();await expect(check.getByRole('status')).toContainText('Total ajustado: 5');
  expect(errors).toEqual([]);
});
test('botão de entrada relê identidade após reordenar/renomear; entrada removida não escolhe outra',async({page})=>{
  await open(page);
  await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.setPath('skills',[{id:'other',name:'Outra',rating:8},{id:'practice',name:'Renomeada',rating:4}]);});
  await page.getByLabel('Base',{exact:true}).fill('3');
  const entry=page.locator('.engine-entry').filter({hasText:'Renomeada'});if(await entry.getAttribute('open')===null) await entry.locator('summary').click();await entry.getByRole('button',{name:'Rolar Renomeada',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Fonte do teste')).toHaveValue(JSON.stringify(['skill','id','practice']));
  await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.get().skills.find(item=>item.id==='practice').rating=6;});
  await dialog.getByRole('button',{name:'Rolar teste',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Renomeada: 6');
  await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.get().skills=state.get().skills.filter(item=>item.id!=='practice');});
  await dialog.getByRole('button',{name:'Rolar teste',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Cadastre e selecione uma fonte');
});
test('painel de campo responsivo e impressão conserva valor sem botão',async({page},testInfo)=>{
  await open(page);
  for (const [width,theme] of [[360,'dark'],[768,'light'],[1280,'dark']]) {
    await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    await page.getByRole('button',{name:'Rolar Base',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.getByRole('dialog').screenshot({path:testInfo.outputPath(`check-${width}-${theme}.png`)});await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await expect(page.locator('.print-sheet')).toContainText('Total ajustado');await expect(page.locator('.print-sheet .engine-field-roll')).toHaveCount(0);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
});
test('efeito de cálculo, ajuste e fixo têm precedência distinta do bônus de teste',async({page})=>{
  const example=structuredClone(pkg);example.system.schemaVersion=2;example.system.characterTemplate.schemaVersion=2;example.system.characterTemplate.activeEffects=[];
  example.system.effectDefinitions=[{id:'demo',revision:1,label:'Ajuste de demonstração',stacking:'unique',applicability:'always',duration:{type:'manual'},operations:[
    {type:'add',target:{kind:'calculation',key:'computed.shared'},value:2},{type:'add',target:{kind:'checkModifier',key:'action',unit:'total'},value:2}]}];
  example.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'effectList',label:'Efeitos de demonstração'});
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.locator('#input-import-system').setInputFiles({name:'effects.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(example))});
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.locator('#systems-list .library-card').filter({hasText:example.system.name}).getByRole('button',{name:'Abrir',exact:true}).click();
  await page.getByRole('button',{name:'Ativar Ajuste de demonstração',exact:true}).click();
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('calculationOverrides',{'computed.shared':{mode:'adjust',value:1}});});
  await page.getByLabel('Base',{exact:true}).fill('2');await expect(page.locator('.engine-computed__value')).toHaveText('6');
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('calculationOverrides',{'computed.shared':{mode:'fixed',value:0}});crypto.getRandomValues = array => array.fill(Math.floor(0.5 * 0x100000000));});
  await page.getByLabel('Base',{exact:true}).fill('0');await expect(page.locator('.engine-computed__value')).toHaveText('0');await expect(page.locator('.engine-effects')).toContainText('suprimido pelo valor fixo');
  await page.getByRole('button',{name:'Rolar Total ajustado',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Rolar teste',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Total ajustado: 2');
});
