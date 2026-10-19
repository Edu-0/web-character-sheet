import {expect,test} from '@playwright/test';

async function ready(page){await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');}

test('catálogo compacto e bibliotecas em linhas preservam comandos, teclado e nomes longos',async({page})=>{
  await ready(page);
  for(const width of [320,360,768,1024,1280,1440]){
    await page.setViewportSize({width,height:900});
    const catalog=page.getByRole('button',{name:'Catálogo',exact:true});
    const box=await catalog.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    await catalog.focus();await page.keyboard.press('Enter');await expect(catalog).toHaveAttribute('aria-current','page');
    await page.getByRole('button',{name:'Sistemas',exact:true}).click();
    const card=page.locator('#systems-list [data-system-id="dnd2024"]');
    await expect(card.getByRole('button',{name:'Abrir',exact:true})).toBeVisible();
    await expect(card.getByRole('button',{name:'Editar pacote',exact:true})).toBeVisible();
    await expect(card.getByRole('button',{name:'Excluir sistema',exact:true})).toBeVisible();
    await card.locator('.library-card__title').evaluate(el=>el.textContent='Sistema com um título muito longo para conferir a distribuição e os comandos completos');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(card).toHaveCSS('box-shadow','none');
  }
});

test('superfície contínua mantém campos, temas e sincronização com D&D estática',async({page})=>{
  await ready(page);
  await page.getByRole('button',{name:'Comparar lado a lado',exact:true}).click();
  const modular=page.locator('#generic-sheet-host');
  await modular.getByLabel('Nome do personagem',{exact:true}).fill('Lia do design');
  await expect(page.locator('#legacy-dnd-sheet [data-bind="identity.name"]')).toHaveValue('Lia do design');
  const pv=modular.getByLabel('PV Atual',{exact:true});await pv.fill('17');
  await expect(page.locator('#legacy-dnd-sheet [data-bind="combat.hpCurrent"]')).toHaveValue('17');
  for(const theme of ['light','dark'])for(const palette of ['classic','editorial','forest','ruby','monochrome','petals']){
    await page.evaluate(async({theme,palette})=>{const ui=await import('/js/theme.js');ui.applyPalette(palette);ui.applyTheme(theme);},{theme,palette});
    await expect(modular.locator('.engine-section').first()).toHaveCSS('box-shadow','none');
    await expect(pv).toHaveValue('17');await expect(pv).toBeVisible();
    expect(await pv.evaluate(el=>getComputedStyle(el).color!==getComputedStyle(el).backgroundColor)).toBe(true);
  }
  await expect(page.locator('#save-indicator')).toHaveText('Salvo');await page.reload();
  await expect(page.locator('#shell-current-character')).toHaveText('Lia do design');
  await expect(page.locator('#generic-sheet-host').getByLabel('PV Atual',{exact:true})).toHaveValue('17');
});

test('prévia real recebe composição e Modo mesa, conservando isolamento da amostra',async({page})=>{
  await ready(page);
  const before=await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()));
  await page.evaluate(async()=>{
    const {getSystemPackage}=await import('/js/repositories/system-repository.js');
    const pkg=await getSystemPackage('dnd2024');
    const host=document.createElement('div');host.id='design-preview';document.body.append(host);
    window.designPreview=new (await import('/js/editor/preview-host.js')).PreviewHost(host);
    window.designPackage=pkg;
    await window.designPreview.mount(pkg,{revision:1,layoutId:pkg.layouts.find(layout=>layout.mode==='table').id});
  });
  const frame=page.frameLocator('#design-preview iframe:not([hidden])');
  await expect(frame.locator('#preview-sheet')).toHaveAttribute('data-sheet-mode','table');
  await expect(frame.locator('.engine-section').first()).toHaveCSS('box-shadow','none');
  await frame.getByLabel('PV Atual',{exact:true}).fill('12');
  expect(await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()))).toEqual(before);
  await page.evaluate(async()=>{const pkg=window.designPackage;await window.designPreview.mount(pkg,{revision:2,layoutId:pkg.layouts.find(layout=>!layout.mode).id});});
  await expect(frame.locator('#preview-sheet')).toHaveAttribute('data-sheet-mode','sheet');
  await expect(frame.getByLabel('Nome do personagem',{exact:true})).toBeVisible();
});
