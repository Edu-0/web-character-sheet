import {editorMode,editorCommand,editorArea,editorTool,editorFamily} from '../helpers/editor-workspace-nav.js';
import {test,expect} from '@playwright/test';
const open=async page=>{await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.getByRole('button',{name:'Criar pacote',exact:true}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');await editorMode(page,'json');};
test('autosave inválido/reload/reabrir conserva última válida; backup exclui rascunhos',async({page})=>{
  await open(page);const original=await page.locator('#editor-json').inputValue();await editorMode(page,'json');await page.locator('#editor-json').fill('{ invalid,');await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');await expect(page.locator('#editor-status')).toContainText('revisão 1');
  const before=await page.evaluate(async()=>{const backup=(await import('/js/library-backup.js')).exportLibrary();return JSON.stringify(backup);});expect(before).not.toContain('rpg-editor-draft');
  await page.reload();await expect(page.getByRole('button',{name:'Recuperar rascunho'})).toBeVisible();await page.getByRole('button',{name:'Recuperar rascunho'}).click();await expect(page.locator('#editor-json')).toHaveValue('{ invalid,');await expect(page.getByRole('button',{name:'Desfazer no editor'})).toBeDisabled();
  await editorCommand(page,'Restaurar última válida');await expect(page.locator('#editor-json')).toHaveValue(original);await page.locator('#editor-json').press('Control+z');await expect(page.locator('#editor-json')).toHaveValue('{ invalid,');
});
test('quota mantém texto em memória, download e saída segura sem prometer save',async({page})=>{
  await open(page);await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('ficha-rpg:editor:'))throw new DOMException('Quota de rascunho','QuotaExceededError');return original.call(this,key,value);};});
  await editorMode(page,'json');await page.locator('#editor-json').fill('{ quota');await editorCommand(page,'Salvar rascunho');await expect(page.locator('#editor-status')).toContainText('Texto preservado');
  await editorCommand(page,'Sair do editor');await page.getByRole('button',{name:'Continuar editando'}).click();await expect(page.locator('#editor-json')).toHaveValue('{ quota');
  await editorCommand(page,'Sair do editor');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar e sair'}).click();expect((await download).suggestedFilename()).toBe('rascunho-rpg.json');await expect(page.locator('#view-systems')).toBeVisible();
});
test('duas abas recusam autosave divergente, salvam cópia e excluem só rascunho explícito',async({page,context})=>{
  await open(page);await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');const second=await context.newPage();await second.goto('/');await expect(second.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await second.getByRole('button',{name:'Sistemas',exact:true}).click();await second.getByRole('button',{name:'Recuperar rascunho'}).click();
  await editorMode(page,'json');await page.locator('#editor-json').fill('{ primeira');await editorCommand(page,'Salvar rascunho');await expect(page.locator('#editor-status')).toContainText('revisão 1');
  await editorMode(second,'json');await second.locator('#editor-json').fill('{ segunda');await editorCommand(second,'Salvar rascunho');await expect(second.locator('#editor-status')).toContainText('outra aba');await editorCommand(second,'Salvar rascunho como cópia');await expect(second.locator('#editor-status')).toContainText('Rascunho salvo');
  const texts=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('ficha-rpg:editor:')).map(key=>JSON.parse(localStorage[key]).text));expect(texts.sort()).toEqual(['{ primeira','{ segunda']);
  await editorCommand(second,'Sair do editor');await expect(second.getByRole('button',{name:'Recuperar rascunho'})).toHaveCount(2);
  await second.getByRole('button',{name:'Excluir rascunho',exact:true}).first().click();await second.getByRole('dialog').getByRole('button',{name:'Excluir rascunho',exact:true}).click();await expect(second.getByRole('button',{name:'Recuperar rascunho'})).toHaveCount(1);
});
test('bruto corrompido/futuro é baixável e não recriado',async({page})=>{
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.evaluate(()=>{localStorage.setItem('ficha-rpg:editor:v1:draft:future','{"kind":"rpg-editor-draft","schemaVersion":99}');localStorage.setItem('ficha-rpg:editor:v1:draft:broken','{ broken');});
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();await expect(page.locator('#editor-drafts')).toContainText('corrompido');await expect(page.getByRole('button',{name:'Baixar original'})).toHaveCount(2);
  expect(await page.evaluate(()=>localStorage.getItem('ficha-rpg:editor:v1:draft:broken'))).toBe('{ broken');
});

for(const leave of [false,true])test(`montagem inicial atrasada preserva ${leave?'saída e nova sessão':'edição, save, cursor e aparência'}`,async({page})=>{
  let release,blocked=false;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/js/editor/generated/preview.js',async route=>{blocked=true;await gate;await route.continue();});
  try{
    await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.getByRole('button',{name:'Criar pacote',exact:true}).click();await expect.poll(()=>blocked).toBe(true);
    await editorMode(page,'json');const area=page.locator('#editor-json');await area.fill('{ enquanto monta');await editorCommand(page,'Salvar rascunho');await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');
    if(leave){
      await editorCommand(page,'Sair do editor');await expect(page.locator('#view-systems')).toBeVisible();await page.getByRole('button',{name:'Criar pacote',exact:true}).click();release();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');await expect(page.locator('#editor-status')).not.toContainText('descartada');await expect(page.locator('#editor-json')).not.toHaveValue('{ enquanto monta');
    }else{
      if(!await page.locator('.workspace-display').evaluate(n=>n.open))await page.locator('.workspace-display>summary').click();await page.getByLabel('Tema do ensaio').selectOption('light');await area.focus();await area.evaluate(node=>node.setSelectionRange(5,9));release();await expect(page.locator('#editor-preview-status')).toContainText('Prévia desatualizada');await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');await expect(page.locator('#editor-status')).not.toContainText('recuperado');await expect(area).toHaveValue('{ enquanto monta');expect(await area.evaluate(node=>[node.selectionStart,node.selectionEnd])).toEqual([5,9]);await expect(page.frameLocator('.editor-preview-frame:not([hidden])').locator('html')).toHaveAttribute('data-theme','light');
    }
  }finally{release();}
});

test('sair imediatamente conserva tema/largura/layout/divisor e cursor sem confirmar texto salvo',async({page})=>{
  await open(page);const area=page.locator('#editor-json'),pkg=JSON.parse(await area.inputValue());pkg.layouts.push({...structuredClone(pkg.layouts[0]),id:'second'});await area.fill(JSON.stringify(pkg));await editorCommand(page,'Salvar rascunho');await expect(page.locator('#editor-status')).toContainText('revisão 1');
  await page.getByLabel('Layout de ensaio').selectOption('second');if(!await page.locator('.workspace-display').evaluate(n=>n.open))await page.locator('.workspace-display>summary').click();await page.getByLabel('Tema do ensaio').selectOption('light');await page.getByLabel('Largura do ensaio').selectOption('360');await page.getByLabel('Largura do painel JSON').fill('65');await area.evaluate(node=>node.setSelectionRange(20,35));
  await editorCommand(page,'Sair do editor');await expect(page.locator('#view-systems')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'Recuperar rascunho'}).click();await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 1');await expect(page.getByLabel('Layout de ensaio')).toHaveValue('second');await expect(page.locator('.workspace-display select').first()).toHaveValue('light');await expect(page.getByLabel('Largura do ensaio')).toHaveValue('360');await expect(page.getByLabel('Largura do painel JSON')).toHaveValue('65');expect(await area.evaluate(node=>[node.selectionStart,node.selectionEnd])).toEqual([20,35]);
});
