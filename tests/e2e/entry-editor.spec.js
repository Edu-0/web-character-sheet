import {editorMode} from '../helpers/editor-workspace-nav.js';
import {test, expect} from '@playwright/test';
import {minimalPackage} from '../legacy-editor-package.js';
import {populate} from '../design-fixtures.mjs';
const host = '#generic-sheet-host';
const dialog = page => page.locator('dialog.engine-entry-editor[open]');
const read = page => page.evaluate(async () => structuredClone((await import('/js/state.js')).state.get()));
async function ready(page) { await page.goto('/'); await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)',{timeout:15000}); }
async function seed(page) {
  await page.evaluate(async () => (await import('/js/state.js')).state.setPath('features', [{id:'gift', name:'Passo lunar', source:'Origem de teste', usesCurrent:2, usesMax:3, recoverOn:'shortRest', description:'Caminha pela luz da lua.\nConserva os detalhes.', notes:'Nota da mesa', opaque:{source:'keep'}}]));
  await page.locator(host).getByRole('tab',{name:'Habilidades',exact:true}).click();
}
async function expand(entry) { if(await entry.getAttribute('open')===null) await entry.locator('.engine-entry__title').click(); }

test('leitura, rascunho cancelável e salvamento único com histórico e persistência', async ({page}) => {
  await ready(page); await seed(page);
  const entry=page.locator(`${host} .engine-entry[data-entry-id="gift"]`); await expand(entry);
  await expect(entry.getByLabel('Nome',{exact:true})).toHaveCount(0);
  await expect(entry.locator('[data-item-field="description"]')).toContainText('Caminha pela luz');
  await expect(entry.getByLabel('Usos Atuais',{exact:true})).toBeVisible();
  const before=await read(page), history=await page.locator('#edit-history-status').textContent();
  await entry.getByRole('button',{name:'Editar Passo lunar',exact:true}).click();
  await dialog(page).getByLabel('Nome',{exact:true}).fill('Rascunho');
  await dialog(page).getByLabel('Descrição',{exact:true}).fill('Ainda sem salvar');
  expect(await read(page)).toEqual(before);
  await dialog(page).getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await read(page)).toEqual(before); expect(await page.locator('#edit-history-status').textContent()).toBe(history);
  await expect(entry.getByRole('button',{name:'Editar Passo lunar',exact:true})).toBeFocused();
  await entry.getByRole('button',{name:'Editar Passo lunar',exact:true}).click();
  await dialog(page).getByLabel('Nome',{exact:true}).fill('Passo solar');
  await dialog(page).getByLabel('Descrição',{exact:true}).fill('Descrição revisada');
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  expect((await read(page)).features[0]).toMatchObject({id:'gift',name:'Passo solar',description:'Descrição revisada',opaque:{source:'keep'}});
  await page.locator('#btn-undo-edit').click(); expect((await read(page)).features).toEqual(before.features);
  await page.locator('#btn-redo-edit').click(); expect((await read(page)).features[0].name).toBe('Passo solar');
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload(); await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  expect((await read(page)).features[0].description).toBe('Descrição revisada');
});

test('técnica autoral salva pelo lápis sem cobrar evolução e começa no nome, com ajuda preservada', async ({page}) => {
  await ready(page);await page.getByRole('button',{name:'Sistemas',exact:true}).click();
  await page.locator('#systems-list [data-system-id="sistema-rpg"]').getByRole('button',{name:'Abrir',exact:true}).click();
  await expect(page.locator('#shell-current-system')).toHaveText('Sistema de RPG');
  const sample=populate(await read(page),'sistema-rpg');
  await page.locator('#input-import-file').setInputFiles({name:'authoral-entry.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))});
  await expect(page.locator('#shell-current-character')).toHaveText(sample.name);
  await page.locator(host).getByRole('tab',{name:'Técnicas',exact:true}).click();
  const before=await read(page);await page.locator(host).getByRole('button',{name:'Editar Luz mantida',exact:true}).click();
  await expect(dialog(page).getByLabel('Nome',{exact:true})).toBeFocused();
  await expect(dialog(page).getByRole('button',{name:'Ajuda: Nome',exact:true})).toBeVisible();
  await dialog(page).getByLabel('Nome',{exact:true}).fill('Luz revisada');
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(dialog(page)).toHaveCount(0);
  const after=await read(page);expect(after.techniques).toEqual(before.techniques.map(item=>({...item,name:'Luz revisada'})));
  expect(after.progression).toEqual(before.progression);expect(after.scene).toEqual(before.scene);expect(after.resources).toEqual(before.resources);
});

test('incluir abre rascunho sem criar item vazio; inventário continua direto e ficha estática sincroniza', async ({page}) => {
  await ready(page); await seed(page); const before=await read(page);
  await page.getByRole('button',{name:'Adicionar Habilidade',exact:true}).click();
  await dialog(page).getByLabel('Nome',{exact:true}).fill('Cancelada'); await page.keyboard.press('Escape');
  expect((await read(page)).features).toEqual(before.features);
  await page.getByRole('button',{name:'Adicionar Habilidade',exact:true}).click();
  await dialog(page).getByLabel('Nome',{exact:true}).fill('Nova habilidade'); await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  expect((await read(page)).features).toHaveLength(2);
  const entry=page.locator(`${host} .engine-entry[data-entry-id="gift"]`); await expand(entry);
  await entry.getByLabel('Usos Atuais',{exact:true}).fill('1'); expect((await read(page)).features[0].usesCurrent).toBe(1);
  await page.getByRole('button',{name:'Comparar lado a lado',exact:true}).click();
  await page.locator('#legacy-dnd-sheet').getByRole('tab',{name:'Habilidades',exact:true}).click();
  await expect(page.locator('#features-list [data-id="gift"] [data-el="meta-display"]')).toContainText('1/3 usos');
  expect((await read(page)).features[0].usesCurrent).toBe(1);
  await page.locator(host).getByRole('tab',{name:'Inventário',exact:true}).click();
  await page.locator(host).getByRole('button',{name:/Adicionar/}).click();
  await expect(dialog(page)).toHaveCount(0); await expect(page.locator(`${host} .engine-table tbody input`).first()).toBeVisible();
});

async function mountHarness(page) {
  await page.evaluate(async () => {
    const {renderSheet}=await import('/js/engine/renderer.js');
    window.entryModel={meta:{system:'test',id:'test'},locked:false,things:[{id:'a',title:'Alpha',count:2,note:'Original'}]};window.entryWrites=0;
    const root=document.createElement('div');root.id='entry-harness';document.body.prepend(root);
    const component={type:'list',field:'things',label:'Objetos',editMode:'dialog',quickFields:['count'],disabledWhen:{field:'locked',equals:true},itemSchema:{title:{type:'text',label:'Título'},count:{type:'number',label:'Saldo'},note:{type:'textarea',label:'Observação'}}};
    window.remountEntryHarness=()=>{window.entryHarness?.destroy();window.entryHarness=renderSheet(root,{id:'h',tabs:[{id:'one',label:'Uma',sections:[{id:'s',containers:[{id:'c',components:[component]}]}]}]},window.entryModel,{onChange:()=>window.entryWrites++,validateCharacter:c=>{if(c.things.some(x=>x.count<0))throw Error('Saldo deve ser positivo.');}});};window.remountEntryHarness();
  });
}
test('salvar preserva alterações rápidas, recusa conflito/remoção/condição e mantém rascunho inválido', async ({page}) => {
  await ready(page); await mountHarness(page);
  const edit=page.locator('#entry-harness .engine-entry__edit');await edit.click();
  await dialog(page).getByLabel('Título',{exact:true}).fill('Beta');
  await page.evaluate(()=>{window.entryModel.things[0].count=1;});
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  expect(await page.evaluate(()=>window.entryModel.things[0])).toEqual({id:'a',title:'Beta',count:1,note:'Original'});
  await edit.click();await dialog(page).getByLabel('Observação').fill('Rascunho');
  await page.evaluate(()=>{window.entryModel.things[0].note='Concorrente';});
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(dialog(page).getByRole('alert')).toContainText('também mudou');await expect(dialog(page).getByLabel('Observação')).toHaveValue('Rascunho');
  await page.keyboard.press('Escape');await edit.click();await dialog(page).getByLabel('Saldo').fill('-1');
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();await expect(dialog(page).getByRole('alert')).toContainText('positivo');
  expect(await page.evaluate(()=>window.entryModel.things[0].count)).toBe(1);
  await dialog(page).getByLabel('Saldo').fill('1');await page.evaluate(()=>window.entryModel.locked=true);
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();await expect(dialog(page).getByRole('alert')).toContainText('disponível');
  await page.evaluate(()=>{window.entryModel.locked=false;window.entryModel.things=[];});
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();await expect(dialog(page).getByRole('alert')).toContainText('removida');
  await page.evaluate(()=>window.entryHarness.destroy());await expect(dialog(page)).toHaveCount(0);
});

test('remontagem conserva rascunho, foco e conflitos; Salvar usa a lista atual sem perder controles rápidos', async ({page}) => {
  await ready(page);await mountHarness(page);
  await page.locator('#entry-harness .engine-entry__edit').click();
  await dialog(page).getByLabel('Título',{exact:true}).fill('Beta pendente');
  await page.evaluate(()=>{window.entryModel.things[0].count=1;window.remountEntryHarness();});
  await expect(dialog(page).getByLabel('Título',{exact:true})).toHaveValue('Beta pendente');
  await expect(dialog(page).getByLabel('Título',{exact:true})).toBeFocused();
  expect(await page.evaluate(()=>window.entryWrites)).toBe(0);
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  expect(await page.evaluate(()=>window.entryModel.things[0])).toMatchObject({title:'Beta pendente',count:1});
  expect(await page.evaluate(()=>window.entryWrites)).toBe(1);
  await page.locator('#entry-harness .engine-entry__edit').click();
  await dialog(page).getByLabel('Observação').fill('Minha revisão');
  await page.evaluate(()=>{window.entryModel.things[0].note='Revisão externa';window.remountEntryHarness();});
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(dialog(page).getByRole('alert')).toContainText('também mudou');
  await expect(dialog(page).getByLabel('Observação')).toHaveValue('Minha revisão');
  await dialog(page).getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(()=>window.entryModel.things[0].note)).toBe('Revisão externa');
  await page.locator('#entry-harness .engine-collection__toolbar').getByRole('button',{name:'Adicionar',exact:true}).click();
  await dialog(page).getByLabel('Título',{exact:true}).fill('Novo item pendente');
  await page.evaluate(()=>window.remountEntryHarness());
  expect(await page.evaluate(()=>window.entryModel.things.length)).toBe(1);
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  expect(await page.evaluate(()=>window.entryModel.things.map(x=>x.title))).toEqual(['Beta pendente','Novo item pendente']);
});

test('remontagem da ficha real mantém a edição até Salvar e não altera outro campo atualizado', async ({page}) => {
  await ready(page);await seed(page);
  await page.locator(`${host} .engine-entry[data-entry-id="gift"]`).getByRole('button',{name:'Editar Passo lunar',exact:true}).click();
  await dialog(page).getByLabel('Nome',{exact:true}).fill('Passo da aurora');
  await page.evaluate(async()=>{const {state}=await import('/js/state.js');state.setPath('features.0.usesCurrent',1);});
  await expect(dialog(page).getByLabel('Nome',{exact:true})).toHaveValue('Passo da aurora');
  expect((await read(page)).features[0].name).toBe('Passo lunar');
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  expect((await read(page)).features[0]).toMatchObject({name:'Passo da aurora',usesCurrent:1});
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');
  await page.reload();
  await expect.poll(async()=>(await read(page))?.features?.[0]?.name).toBe('Passo da aurora');
});

test('lista removida mantém o texto para cópia sem salvar; outra ficha encerra a janela anterior', async ({page}) => {
  await ready(page);await mountHarness(page);
  await page.locator('#entry-harness .engine-entry__edit').click();
  await dialog(page).getByLabel('Título',{exact:true}).fill('Preservar este texto');
  await page.evaluate(async()=>{
    const {renderSheet}=await import('/js/engine/renderer.js');window.entryHarness.destroy();
    window.entryHarness=renderSheet(document.querySelector('#entry-harness'),{id:'other',tabs:[]},window.entryModel);
  });
  await expect(dialog(page).getByLabel('Título',{exact:true})).toHaveValue('Preservar este texto');
  await dialog(page).getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(dialog(page).getByRole('alert')).toContainText('lista não está disponível');
  expect(await page.evaluate(()=>window.entryModel.things[0].title)).toBe('Alpha');
  await page.evaluate(()=>{window.entryModel={...window.entryModel,meta:{system:'test',id:'another'}};window.remountEntryHarness();});
  await expect(dialog(page)).toHaveCount(0);
  expect(await page.evaluate(()=>window.entryWrites)).toBe(0);
});

test('diálogo acessível e responsivo; texto longo, temas, redução de efeitos e impressão', async ({page},testInfo) => {
  await ready(page);await seed(page);
  const edit=page.locator(`${host} .engine-entry__edit`).first();
  for(const theme of ['light','dark'])for(const width of [320,768,1280]){
    await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await edit.click();const box=dialog(page);await expect(box).toHaveAccessibleName('Editar Passo lunar');
    await box.getByLabel('Descrição',{exact:true}).fill('Texto longo para conferir o rascunho. '.repeat(35));
    await box.getByRole('button',{name:'Salvar',exact:true}).focus();await page.keyboard.press('Tab');await expect(box.getByLabel('Nome',{exact:true})).toBeFocused();
    expect(await box.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await box.screenshot({path:testInfo.outputPath(`dialog-${theme}-${width}.png`)});
    await page.keyboard.press('Escape');await expect(edit).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.evaluate(()=>document.documentElement.dataset.materialEffects='off');await edit.click();
  expect(await dialog(page).evaluate(el=>getComputedStyle(el,'::backdrop').backdropFilter)).toBe('none');
  await page.emulateMedia({media:'print'});await expect(dialog(page)).toBeHidden();await page.emulateMedia({media:'screen'});await page.keyboard.press('Escape');
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root')).toContainText('Caminha pela luz da lua.');
  await expect(page.locator('#print-root')).not.toContainText('Texto longo para conferir o rascunho.');
});

test('prévia isolada oferece a mesma edição e não escreve no personagem ativo', async ({page}) => {
  await ready(page);const before=await read(page),pkg=minimalPackage('entry-preview');
  pkg.system.characterTemplate.items=[{id:'a',name:'Ensaio',note:'Texto'}];
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'list',field:'items',label:'Lista de ensaio',editMode:'dialog',itemSchema:{name:{type:'text',label:'Título'},note:{type:'textarea',label:'Detalhes'}}});
  await page.evaluate(async pkg=>{const root=document.createElement('div');root.id='entry-preview';document.body.prepend(root);window.entryPreview=new(await import('/js/editor/preview-host.js')).PreviewHost(root);await window.entryPreview.mount(pkg,{revision:1,layoutId:pkg.layouts[0].id});},pkg);
  const frame=page.frameLocator('#entry-preview iframe:not([hidden])');await frame.getByRole('button',{name:'Editar Ensaio',exact:true}).click();
  await frame.getByRole('dialog').getByLabel('Título').fill('Mudou só no ensaio');await frame.getByRole('dialog').getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(frame.locator('.engine-entry__title')).toHaveText('Mudou só no ensaio');expect(await read(page)).toEqual(before);
  await frame.getByRole('button',{name:'Editar Mudou só no ensaio',exact:true}).click();await page.evaluate(()=>window.entryPreview.dispose());
  await expect(page.locator('#entry-preview iframe')).toHaveCount(0);expect(await read(page)).toEqual(before);
});

test('modo de edição é configurável por formulário e conserva o histórico do pacote', async ({page}) => {
  await ready(page);const pkg=minimalPackage('entry-authoring');
  pkg.system.characterTemplate.items=[{id:'a',name:'Registro'}];
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'list',field:'items',label:'Objetos',editMode:'inline',itemSchema:{name:{type:'text',label:'Título'}}});
  await page.getByRole('button',{name:'Sistemas',exact:true}).click();
  await page.locator('#input-editor-file').setInputFiles({name:'entry-authoring.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});
  await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão 0');
  await editorMode(page,'forms');
  await page.getByRole('treeitem',{name:'Componente · Objetos',exact:true}).click();
  const before=await page.locator('#editor-json').inputValue();
  const property=page.locator('[data-property="/layouts/0/tabs/0/sections/0/containers/0/components/4/editMode"]');
  await property.getByLabel('Modo de edição das entradas',{exact:true}).selectOption('dialog');
  await property.getByRole('button',{name:'Aplicar campo',exact:true}).click();
  const current=JSON.parse(await page.locator('#editor-json').inputValue());
  expect(current.layouts[0].tabs[0].sections[0].containers[0].components[4].editMode).toBe('dialog');
  expect(current.system).toEqual(pkg.system);
  await page.getByRole('button',{name:'Desfazer no editor',exact:true}).click();
  expect(await page.locator('#editor-json').inputValue()).toBe(before);
});
