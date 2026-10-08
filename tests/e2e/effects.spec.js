import {test,expect} from '@playwright/test';
async function openSwade(page){
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();
  await page.locator('#systems-list .library-card').filter({hasText:'Savage Worlds SWADE'}).getByRole('button',{name:'Abrir',exact:true}).click();
  await page.locator('#sheet-layout-select').selectOption('swade-table');
}
const state=page=>page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()));
test('Coringa explícito, contribuições, fim confirmado, undo/redo, impressão e persistência @smoke',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openSwade(page);
  const host=page.locator('#generic-sheet-host'),effects=host.locator('.engine-effects');
  const before=await state(page);await effects.getByRole('button',{name:'Ativar Coringa',exact:true}).click();
  await expect(effects).toContainText('Coringa · Ativo');
  await effects.getByRole('button',{name:'Ativar Coringa',exact:true}).click();await expect(effects.getByRole('status')).toContainText('já está ativo');
  const check=host.locator('.engine-check').first();await expect(check).toContainText('Coringa +2');
  await page.evaluate(()=>{crypto.getRandomValues = array => array.fill(Math.floor(0.5 * 0x100000000));});
  await check.getByLabel('Modificador do teste').fill('1');await check.getByRole('button',{name:'Rolar teste',exact:true}).click();
  await expect(check.getByRole('status')).toContainText('Agilidade: 7');
  const snapshot=await page.evaluate(async()=>structuredClone((await import('/js/dice.js')).getHistory()[0].snapshot));expect(snapshot.effects.value).toBe(2);
  expect((await state(page)).attributes).toEqual(before.attributes);
  await effects.getByRole('button',{name:'Confirmar fim de rodada'}).click();await page.getByRole('button',{name:'Confirmar evento',exact:true}).click();
  await expect(effects).toContainText('Coringa · Expirado');
  await page.locator('#btn-undo-edit').click();await expect(effects).toContainText('Coringa · Ativo');
  await page.locator('#btn-redo-edit').click();await expect(effects).toContainText('Coringa · Expirado');
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await expect(page.locator('.print-sheet')).toContainText('Coringa · Expirado');
  await expect(page.locator('.print-sheet .engine-effects button')).toHaveCount(0);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');await page.reload();await expect(effects).toContainText('Coringa · Expirado');
  expect(errors).toEqual([]);
});
test('ativar em v1 migra com original recuperável e backup v2',async({page})=>{
  await openSwade(page);
  await page.evaluate(async()=>{const {state}=await import('/js/state.js');const c=state.get();c.schemaVersion=1;delete c.activeEffects;c.extra={zero:0,off:false};await (await import('/js/repositories/character-repository.js')).saveCharacter(c);state.syncHistoryBaseline();});
  await page.getByRole('button',{name:'Ativar Coringa',exact:true}).click();await page.getByRole('button',{name:'Migrar e ativar',exact:true}).click();
  await expect(page.locator('.engine-effects')).toContainText('Coringa · Ativo');
  const data=await page.evaluate(async()=>{const c=(await import('/js/state.js')).state.get();const originals=(await import('/js/persistence.js')).recoveryEntries().filter(e=>/migração/.test(e.reason)).map(e=>JSON.parse(e.raw));const backup=(await import('/js/library-backup.js')).exportLibrary(c);return {c,originals,version:backup.schemaVersion};});
  expect(data.c.schemaVersion).toBe(2);expect(data.c.extra).toEqual({zero:0,off:false});expect(data.originals.some(c=>c.schemaVersion===1&&c.extra?.off===false)).toBe(true);expect(data.version).toBe(2);
  await page.locator('#btn-undo-edit').click();expect((await state(page)).schemaVersion).toBe(2);expect((await state(page)).activeEffects).toEqual([]);
});
test('efeitos legíveis e acionáveis nos temas e larguras de mesa',async({page},testInfo)=>{
  await openSwade(page);await page.getByRole('button',{name:'Ativar Coringa',exact:true}).click();
  for (const [width,theme] of [[360,'light'],[768,'dark'],[1280,'light']]) {
    await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    const button=page.getByRole('button',{name:'Desativar Coringa',exact:true});await button.focus();await expect(button).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator('.engine-effects').screenshot({path:testInfo.outputPath(`effects-${width}-${theme}.png`)});
  }
});
