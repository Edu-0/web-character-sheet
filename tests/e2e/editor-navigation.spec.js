import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {minimalPackage} from '../../js/editor/minimal-package.js';

const base='/layouts/0/tabs/0/sections/0/containers/0/components/';
const frame=page=>page.frameLocator('.editor-preview-frame:not([hidden])');
async function open(page){
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await page.evaluate(async()=>{
    const {PreviewHost}=await import('/js/editor/preview-host.js'),mount=PreviewHost.prototype.mount;
    PreviewHost.prototype.mount=function(...args){window.navigationHost=this;return mount.apply(this,args);};
  });
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();await page.getByRole('button',{name:'Criar pacote',exact:true}).click();
  await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');
}
async function load(page,pkg){
  await page.locator('#editor-json').fill(JSON.stringify(pkg,null,2));
  await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();
  await expect(page.getByRole('button',{name:'Localizar no JSON',exact:true})).toBeEnabled();
}
const selected=page=>page.locator('#editor-json').evaluate(node=>node.value.slice(node.selectionStart,node.selectionEnd));
async function cursor(page,needle){
  await page.locator('#editor-json').evaluate((node,needle)=>{
    const index=node.value.indexOf(needle);if(index<0)throw new Error(`Missing ${needle}`);node.focus();node.setSelectionRange(index+2,index+2);
  },needle);
}
const real=page=>page.evaluate(async()=>({
  character:structuredClone((await import('/js/state.js')).state.get()),history:(await import('/js/state.js')).state.historyStatus(),
  rolls:structuredClone((await import('/js/dice.js')).getHistory()),
  storage:Object.fromEntries(Object.entries(localStorage).filter(([key])=>!key.startsWith('ficha-rpg:editor:'))),
}));

test('localizar texto, campo, botão e controle desabilitado seleciona bloco sem executar ações',async({page})=>{
  await open(page);const pkg=minimalPackage('navigation'),components=pkg.layouts[0].tabs[0].sections[0].containers[0].components;
  components.push({type:'counter',field:'score',label:'Contagem'},{type:'counter',field:'score',label:'Bloqueado',disabledWhen:{field:'score',equals:2}});
  await load(page,pkg);await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');const before=await real(page),text=await page.locator('#editor-json').inputValue();
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();
  for(const [target,index]of [[frame(page).getByText('Nome',{exact:true}),0],[frame(page).getByLabel('Base',{exact:true}),1],[frame(page).locator('.engine-computed__value'),3],[frame(page).getByRole('button',{name:'Aumentar Contagem',exact:true}),4],[frame(page).getByRole('button',{name:'Aumentar Bloqueado',exact:true}),5]]){
    await target.click({force:index===5});await expect(page.locator('#editor-json')).toBeFocused();
    expect(JSON.parse(await selected(page))).toEqual(components[index]);await expect(frame(page).locator('.engine-counter .computed').first()).toHaveText('2');
  }
  await expect(page.locator('#editor-json')).toHaveValue(text);await expect(page.getByRole('button',{name:'Desfazer JSON',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();
  await frame(page).getByRole('button',{name:'Aumentar Contagem',exact:true}).click();await expect(frame(page).locator('.engine-counter .computed').first()).toHaveText('3');
  await frame(page).getByRole('button',{name:'Aumentar Contagem',exact:true}).dblclick();await expect(frame(page).locator('.engine-counter .computed').first()).toHaveText('5');
  await page.waitForTimeout(700);expect(await real(page)).toEqual(before);
});

test('código abre outra aba, destaca todas as repetições e considera índice/layout reais',async({page})=>{
  await open(page);const pkg=minimalPackage('navigation');pkg.system.catalog=[{key:'a'},{key:'b'}];pkg.system.characterTemplate.values={};
  pkg.layouts[0].tabs.push({id:'other',label:'Outra',sections:[{id:'same',title:'Repetição',containers:[{repeat:{source:'catalog'},components:[{type:'text',field:'values.{key}',label:'Mesmo texto'}]}]}]});
  pkg.layouts.unshift({...structuredClone(pkg.layouts[0]),id:'alternate'});await load(page,pkg);
  await cursor(page,'"field": "values.{key}"'); // first match is the other layout
  await page.getByRole('button',{name:'Mostrar na prévia',exact:true}).click();await expect(page.locator('#editor-navigation-status')).toContainText('não tem elemento direto');
  await page.locator('#editor-json').evaluate(node=>{const offset=node.value.lastIndexOf('"field": "values.{key}"');node.focus();node.setSelectionRange(offset+2,offset+2);});
  await page.locator('#editor-json').press('Alt+Enter');
  const pointer='/layouts/1/tabs/1/sections/0/containers/0/components/0';
  await expect(frame(page).getByRole('tab',{name:'Outra',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(frame(page).locator('[data-editor-source-highlight]')).toHaveCount(2);
  await expect(page.locator('#editor-navigation-status')).toContainText('2 ocorrência(s)');
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await frame(page).getByLabel('Mesmo texto',{exact:true}).nth(1).click();
  expect(JSON.parse(await selected(page))).toEqual(pkg.layouts[1].tabs[1].sections[0].containers[0].components[0]);
  await expect(page.locator('#editor-navigation-status')).toContainText(pointer);
});

test('prévia antiga, JSON inválido, troca de layout e mensagens falsas não deslocam o cursor',async({page})=>{
  await open(page);const area=page.locator('#editor-json'),original=await area.inputValue();
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await area.fill(' '+original);
  await expect(page.getByRole('button',{name:'Localizar no JSON',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Localizar no JSON',exact:true})).toHaveAttribute('aria-pressed','false');
  await area.press('Alt+Enter');await expect(page.locator('#editor-navigation-status')).toContainText('Atualize o ensaio');
  await area.fill('{ invalid');await frame(page).getByLabel('Base',{exact:true}).click();expect(await area.inputValue()).toBe('{ invalid');
  await area.fill(original);await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();await expect(page.getByRole('button',{name:'Localizar no JSON',exact:true})).toBeEnabled();
  await cursor(page,'"label": "Nome"');const before=await area.evaluate(node=>[node.selectionStart,node.selectionEnd]);
  await page.evaluate(()=>{
    const record=window.navigationHost.current;
    for(const data of [{type:'source-picked',protocol:1,...record.context,pointer:'/extra'},{type:'source-picked',protocol:1,...record.context,generation:record.context.generation-1,pointer:'/system/name'}]) record.port.dispatchEvent(new MessageEvent('message',{data}));
    window.postMessage({type:'source-picked',protocol:1,...record.context,pointer:'/system/name'},'*');
  });expect(await area.evaluate(node=>[node.selectionStart,node.selectionEnd])).toEqual(before);
  const pkg=JSON.parse(original);pkg.layouts.push({...structuredClone(pkg.layouts[0]),id:'second'});await load(page,pkg);
  await page.getByLabel('Layout de ensaio').selectOption('second');await expect(page.getByRole('button',{name:'Mostrar na prévia',exact:true})).toBeDisabled();
});

test('teclado localiza sem editar/acionar e Escape devolve interação',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();
  const input=frame(page).getByLabel('Base',{exact:true});await input.focus();await input.press('ArrowUp');await expect(input).toHaveValue('2');await input.press('Enter');
  expect(JSON.parse(await selected(page)).field).toBe('score');await input.focus();await input.press('Escape');
  await expect(page.getByRole('button',{name:'Localizar no JSON',exact:true})).toHaveAttribute('aria-pressed','false');
  await input.press('ArrowUp');await expect(input).toHaveValue('3');
});

test('modal de ação localiza a definição de origem, inclusive após reutilização',async({page})=>{
  await open(page);const pkg=JSON.parse(readFileSync('data/examples/generic-entry-rolls.package.json','utf8'));await load(page,pkg);
  await frame(page).getByRole('button',{name:'Ativar poder',exact:true}).click();
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await frame(page).getByRole('dialog').getByRole('button',{name:'Ativar',exact:true}).click();
  expect(JSON.parse(await selected(page)).type).toBe('list');await expect(frame(page).getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await frame(page).getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  await frame(page).getByLabel('Nome',{exact:true}).first().click(); // move origin away from the previous modal
  await frame(page).getByRole('button',{name:'Ativar poder',exact:true}).click();await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();
  await frame(page).getByRole('dialog').getByRole('heading').click();expect(JSON.parse(await selected(page)).type).toBe('list');
});

test('toque em claro/escuro alterna painéis nos dois sentidos sem ações nem overflow',async({browser},testInfo)=>{
  const context=await browser.newContext({hasTouch:true,viewport:{width:360,height:900}}),page=await context.newPage();
  try{
    await open(page);const area=page.locator('#editor-json');
    for(const [width,theme]of [[360,'light'],[768,'dark'],[1280,'light']]){
      await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      if(width<900)await page.locator('.editor-mobile-tabs').getByRole('button',{name:'Prévia',exact:true}).tap();
      await page.getByLabel('Tema do ensaio').selectOption(theme);await page.getByRole('button',{name:'Localizar no JSON',exact:true}).tap();await frame(page).getByLabel('Base',{exact:true}).tap();
      await expect(area).toBeVisible();expect(JSON.parse(await selected(page)).field).toBe('score');
      await page.getByRole('button',{name:'Mostrar na prévia',exact:true}).tap();await expect(page.locator('.editor-preview')).toBeVisible();await expect(frame(page).locator('[data-editor-source-highlight]')).toHaveCount(1);
      await expect(page.locator('#editor-navigation-status')).toContainText('1 ocorrência(s)');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:testInfo.outputPath(`navigation-${width}-${theme}.png`),fullPage:true});
      await page.locator('.editor-preview-frame:not([hidden])').screenshot({path:testInfo.outputPath(`navigation-preview-${width}-${theme}.png`)});
      await page.getByRole('button',{name:'Localizar no JSON',exact:true}).tap();
      if(width<900)await page.locator('.editor-mobile-tabs').getByRole('button',{name:'JSON',exact:true}).tap();
    }
    await page.evaluate(()=>document.documentElement.style.zoom='2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }finally{await context.close();}
});

test('navegação funciona offline e não modifica pacote, histórico JSON ou personagem',async({page,context})=>{
  await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);await context.setOffline(true);
  await open(page);await expect(page.locator('#editor-status')).toContainText('Rascunho salvo');const before=await real(page),text=await page.locator('#editor-json').inputValue();
  await expect(page.getByRole('button',{name:'Desfazer JSON',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await frame(page).getByText('Personagem',{exact:true}).click();
  expect(JSON.parse(await selected(page)).title).toBe('Personagem');await page.getByRole('button',{name:'Mostrar na prévia',exact:true}).click();await expect(frame(page).locator('[data-editor-source-highlight]')).toHaveCount(1);
  await expect(page.locator('#editor-json')).toHaveValue(text);await expect(page.getByRole('button',{name:'Desfazer JSON',exact:true})).toBeDisabled();await page.waitForTimeout(700);expect(await real(page)).toEqual(before);
});

test('ajuda fora do componente mantém origem no fallback sem popover nativo',async({page})=>{
  await open(page);const pkg=minimalPackage('navigation');pkg.layouts[0].tabs[0].sections[0].containers[0].components[0].help='Texto da ajuda do nome';await load(page,pkg);
  await frame(page).locator('body').evaluate(()=>{
    HTMLElement.prototype.showPopover=undefined;HTMLElement.prototype.hidePopover=undefined;
    // Emulate the missing attribute support too: Edge otherwise retains its
    // native UA display:none rule despite the deliberately removed methods.
    document.querySelectorAll('.engine-help__panel').forEach(panel=>panel.removeAttribute('popover'));
  });
  await frame(page).getByRole('button',{name:'Ajuda: Nome',exact:true}).click();const help=frame(page).getByRole('tooltip');await expect(help).toBeVisible();
  expect(await help.evaluate(node=>node.parentElement===document.body)).toBe(true);
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await help.click();expect(JSON.parse(await selected(page)).help).toBe('Texto da ajuda do nome');
});

test('seleção rola o JSON sem formatá-lo e definição sem instâncias informa ausência de alvo',async({page})=>{
  await open(page);const pkg=minimalPackage('navigation'),area=page.locator('#editor-json'),text='\n'.repeat(500)+JSON.stringify(pkg,null,2);
  await area.fill(text);await page.getByRole('button',{name:'Atualizar / reiniciar ensaio'}).click();await expect(page.getByRole('button',{name:'Localizar no JSON',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await frame(page).getByText('Nome',{exact:true}).click();
  expect(JSON.parse(await selected(page)).field).toBe('identity.name');expect(await area.evaluate(node=>node.scrollTop)).toBeGreaterThan(9000);await expect(area).toHaveValue(text);
  pkg.system.catalog=[];pkg.system.characterTemplate.values={};pkg.layouts[0].tabs[0].sections[0].containers[0]={repeat:{source:'catalog'},components:[{type:'text',field:'values.{key}',label:'Sem entradas'}]};await load(page,pkg);
  await cursor(page,'"label": "Sem entradas"');await page.getByRole('button',{name:'Mostrar na prévia',exact:true}).click();await expect(page.locator('#editor-navigation-status')).toContainText('não gerou elemento');
});

test('JSON Windows preserva CRLF autoritativo ao navegar e selecionar diagnóstico',async({page})=>{
  await open(page);const pkg=minimalPackage('navigation-windows'),raw=JSON.stringify(pkg,null,2).replaceAll('\n','\r\n'),area=page.locator('#editor-json');
  await page.locator('#input-editor-file').setInputFiles({name:'windows.json',mimeType:'application/json',buffer:Buffer.from(raw)});
  await expect(area).toHaveValue(raw.replaceAll('\r\n','\n'));await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');
  await expect(page.getByRole('button',{name:'Localizar no JSON',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Localizar no JSON',exact:true}).click();await frame(page).getByText('Base',{exact:true}).click();
  expect(JSON.parse(await selected(page))).toEqual(pkg.layouts[0].tabs[0].sections[0].containers[0].components[1]);
  await cursor(page,'"label": "Total"');await area.press('Alt+Enter');await expect(frame(page).locator('[data-editor-source-highlight]')).toHaveAttribute('data-editor-source',base+'3');
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(`ficha-rpg:editor:v1:draft:${window.navigationHost.sessionId}`)).text)).toBe(raw);
  pkg.system.name='';const invalid=JSON.stringify(pkg,null,2).replaceAll('\n','\r\n');
  await page.locator('#input-editor-file').setInputFiles({name:'invalid-windows.json',mimeType:'application/json',buffer:Buffer.from(invalid)});
  await expect(area).toHaveValue(invalid.replaceAll('\r\n','\n'));await page.locator('.editor-diagnostics button').filter({hasText:'/system/name'}).click();expect(await selected(page)).toBe('""');
});
