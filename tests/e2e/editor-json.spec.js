import {test,expect} from '@playwright/test';
const open=async page=>{await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.getByRole('button',{name:'Criar pacote',exact:true}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');};
test('abrir/criar, erro, diagnóstico navegável e undo JSON independente do personagem',async({page})=>{
  await open(page);const area=page.locator('#editor-json'),original=await area.inputValue();
  await expect(page.locator('#btn-new-character')).toBeHidden();await expect(page.locator('#btn-clear-character')).toBeHidden();await expect(page.locator('#btn-import')).toBeHidden();
  const before=await page.evaluate(async()=>({character:structuredClone((await import('/js/state.js')).state.get()),history:(await import('/js/state.js')).state.historyStatus()}));
  await area.fill('{ broken');await expect(page.locator('#editor-validation-summary')).toContainText('JSON inválido');await expect(page.locator('#editor-preview-status')).toContainText('desatualizada');
  await expect(page.getByRole('button',{name:'Exportar pacote',exact:true})).toBeDisabled();await area.press('Control+z');await expect(area).toHaveValue(original);
  expect(await page.evaluate(async()=>({character:structuredClone((await import('/js/state.js')).state.get()),history:(await import('/js/state.js')).state.historyStatus()}))).toEqual(before);
  const pkg=JSON.parse(original);pkg.system.name='';await area.fill(JSON.stringify(pkg,null,2));await expect(page.locator('.editor-diagnostics')).toContainText('/system/name');
  await page.locator('.editor-diagnostics button').filter({hasText:'/system/name'}).click();await expect(area).toBeFocused();expect(await area.evaluate(node=>node.value.slice(node.selectionStart,node.selectionEnd))).toBe('""');
  await area.press('Tab');await expect(area).not.toBeFocused();
});
test('cópia D&D preserva extras e escolhe layout/tema só no ensaio',async({page})=>{
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.getByRole('button',{name:'Comparar lado a lado'}).click();
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.locator('#systems-list .library-card').filter({hasText:'D&D 5e'}).getByRole('button',{name:'Editar cópia'}).click();
  await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');const pkg=JSON.parse(await page.locator('#editor-json').inputValue());expect(pkg.system.id).not.toBe('dnd2024');expect(pkg.layouts.every(layout=>layout.system===pkg.system.id)).toBe(true);
  const theme=await page.locator('html').getAttribute('data-theme');await page.getByLabel('Tema do ensaio').selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await page.getByLabel('Layout de ensaio').selectOption('dnd2024-table');await expect(page.locator('#editor-preview-status')).toContainText('desatualizada');await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();await expect(page.locator('#editor-preview-status')).toContainText('dnd2024-table');
  await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');await page.getByRole('button',{name:'Sair do editor'}).click();await page.getByRole('button',{name:'Ficha atual',exact:true}).click();await expect(page.locator('#dnd-sheet-surfaces')).toHaveClass(/compare/);await expect(page.locator('#sheet-layout-select')).toHaveValue('dnd2024-layout');
});
test('painéis acessíveis em 360/768/1280, claro/escuro e zoom',async({page},testInfo)=>{
  await open(page);
  for(const [width,theme]of [[360,'light'],[768,'dark'],[1280,'light']]){
    await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    if(width<900){await page.locator('.editor-mobile-tabs').getByRole('button',{name:'Prévia',exact:true}).click();await expect(page.locator('.editor-preview')).toBeVisible();await page.locator('.editor-mobile-tabs').getByRole('button',{name:'JSON',exact:true}).click();}
    await page.locator('#editor-json').focus();await expect(page.locator('#editor-json')).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator('#view-editor').screenshot({path:testInfo.outputPath(`editor-${width}-${theme}.png`)});
  }
  await page.evaluate(()=>document.documentElement.style.zoom='2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
