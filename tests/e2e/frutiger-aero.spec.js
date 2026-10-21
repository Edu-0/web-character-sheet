import {test,expect} from '@playwright/test';
import {minimalPackage} from '../legacy-editor-package.js';

const settings=page=>page.getByRole('button',{name:'Configurações',exact:true}).click();
const tab=(page,name)=>page.getByRole('tab',{name,exact:true}).click();
const sheet=page=>page.getByRole('button',{name:'Ficha atual',exact:true}).click();
const material=locator=>locator.evaluate(el=>{
  const css=getComputedStyle(el),c=document.createElement('canvas'),ctx=c.getContext('2d');
  ctx.fillStyle=css.backgroundColor;ctx.fillRect(0,0,1,1);
  return {alpha:ctx.getImageData(0,0,1,1).data[3]/255,blur:css.backdropFilter,image:css.backgroundImage};
});
const errors=new WeakMap();
test.beforeEach(async({page})=>{
  const messages=[];errors.set(page,messages);page.on('pageerror',error=>messages.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await settings(page);await tab(page,'Cores');await page.locator('[data-palette-choice="frutiger-aero"]').click();
});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

for(const theme of ['dark','light'])test(`Frutiger Aero ${theme}: lápis mantém vidro, foco e rascunho até cancelar`,async({page},info)=>{
  await page.locator('#appearance-mode').selectOption(theme);await tab(page,'Fundo');
  await page.locator('#appearance-background-mode').selectOption('mega');
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('features',[{id:'aero-entry',name:'Brisa do horizonte',usesCurrent:2,usesMax:3,description:'Uma corrente suave acompanha os passos.'}]);});
  const before=await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()));
  await sheet(page);await page.locator('#generic-sheet-host').getByRole('tab',{name:'Habilidades',exact:true}).click();
  const pencil=page.getByRole('button',{name:'Editar Brisa do horizonte',exact:true});await pencil.click();
  const dialog=page.locator('dialog.engine-entry-editor[open]'),input=dialog.getByLabel('Nome',{exact:true});
  expect((await material(dialog)).alpha).toBeCloseTo(.48,2);expect((await material(input)).alpha).toBe(1);
  await input.fill('Alteração apenas no rascunho');
  for(const width of [1280,360]){
    await page.setViewportSize({width,height:900});await expect(dialog.getByRole('button',{name:'Cancelar',exact:true})).toBeInViewport();
    await expect(input).toHaveValue('Alteração apenas no rascunho');await page.screenshot({path:info.outputPath(`${theme}-${width}-pencil.png`),animations:'disabled'});
  }
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(pencil).toBeFocused();
  expect(await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()))).toBe(before);
});

test('Frutiger Aero conserva janelas opacas no ramo CSS sem filtros',async({page})=>{
  await tab(page,'Fundo');await page.locator('#appearance-background-mode').selectOption('mega');
  await page.evaluate(()=>{
    // Exercita o fallback CSS; não representa um navegador antigo real.
    for(const sheet of [...document.styleSheets].filter(sheet=>/\/(materials|frutiger-aero)\.css$/.test(sheet.href||''))){
      for(const media of [...sheet.cssRules])if(media.cssRules)for(let i=media.cssRules.length-1;i>=0;i--)if(media.cssRules[i] instanceof CSSSupportsRule)media.deleteRule(i);
    }
  });
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage)).not.toContain('37px');
  await page.locator('#appearance-preview-open').click();
  const dialog=page.getByRole('dialog',{name:'Prévia do material',exact:true});
  expect((await material(dialog)).alpha).toBe(1);expect((await material(dialog)).blur).toBe('none');
  await page.keyboard.press('Escape');await expect(page.locator('#appearance-preview-open')).toBeFocused();
});

for(const theme of ['dark','light'])test(`Frutiger Aero ${theme}: cena, reflexos, campos opacos e três materiais em desktop/celular`,async({page},info)=>{
  test.setTimeout(60000); // Seis modais e três capturas de ficha por tema.
  await page.locator('#appearance-mode').selectOption(theme);await page.locator('#appearance-theme-ornaments').click();
  const before=await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()));
  await tab(page,'Fundo');await expect(page.locator('#appearance-background-mode')).toHaveValue('solid');
  for(const [mode,alpha] of [['solid',1],['translucent',.86],['mega',.48]]){
    await page.locator('#appearance-background-mode').selectOption(mode);
    const scene=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(scene.includes('37px')).toBe(mode!=='solid');
    await sheet(page);await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:info.outputPath(`${theme}-${mode}-sheet.png`),animations:'disabled'});
    await settings(page);await tab(page,'Fundo');
    for(const width of [1280,360]){
      await page.setViewportSize({width,height:900});await page.locator('#appearance-preview-open').click();
      const dialog=page.getByRole('dialog',{name:'Prévia do material',exact:true});
      const css=await material(dialog);expect(css.alpha).toBeCloseTo(alpha,2);
      expect(css.blur).toContain(mode==='solid'?'0px':width===360?'12px':mode==='mega'?'28px':'18px');
      expect((await material(dialog.getByLabel('Campo de exemplo'))).alpha).toBe(1);
      expect((await material(dialog.getByRole('button',{name:'Fechar prévia',exact:true}))).image).not.toBe('none');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const bounds=await dialog.boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(900);
      await page.screenshot({path:info.outputPath(`${theme}-${mode}-${width}-dialog.png`),animations:'disabled'});
      await page.keyboard.press('Escape');await expect(page.locator('#appearance-preview-open')).toBeFocused();
    }
  }
  expect(await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()))).toBe(before);
});

test('Frutiger Aero acompanha a prévia e respeita redução, cores forçadas, impressão e troca de paleta',async({page,context})=>{
  await tab(page,'Fundo');await page.locator('#appearance-background-mode').selectOption('mega');
  await page.locator('#appearance-glass-tint').selectOption('azure');
  await page.evaluate(async pkg=>{
    const host=document.createElement('div');host.id='aero-preview';document.body.append(host);
    window.aeroPreview=new(await import('/js/editor/preview-host.js')).PreviewHost(host);
    await window.aeroPreview.mount(pkg,{revision:1,layoutId:pkg.layouts[0].id,appearance:{theme:'light',palette:'frutiger-aero'}});
  },minimalPackage('aero-preview'));
  const frame=page.frameLocator('#aero-preview iframe:not([hidden])');
  await expect(frame.locator('html')).toHaveAttribute('data-palette','frutiger-aero');
  await expect(frame.locator('html')).toHaveAttribute('data-glass-tint','azure');
  expect(await frame.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('37px');
  await page.locator('#appearance-reduce-transparency').check();
  await expect(frame.locator('html')).toHaveAttribute('data-material-effects','off');
  await expect(page.locator('body')).toHaveCSS('background-image','none');
  await expect(frame.locator('body')).toHaveCSS('background-image','none');
  expect((await material(page.locator('.appearance-material-preview__surface'))).alpha).toBe(1);
  await page.locator('#appearance-reduce-transparency').uncheck();
  await page.emulateMedia({forcedColors:'active'});
  await expect(page.locator('body')).toHaveCSS('background-image','none');
  await expect(page.locator('.appearance-material-preview')).toHaveCSS('background-image','none');
  await page.locator('#appearance-preview-open').click();
  const dialog=page.getByRole('dialog',{name:'Prévia do material',exact:true});
  expect((await material(dialog)).alpha).toBe(1);expect((await material(dialog)).blur).toBe('none');
  expect((await material(dialog.getByRole('button',{name:'Fechar prévia',exact:true}))).image).toBe('none');
  await page.keyboard.press('Escape');await page.emulateMedia({forcedColors:'none'});
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  await expect(page.locator('html')).toHaveAttribute('data-material-effects','off');
  await expect(page.locator('body')).toHaveCSS('background-image','none');
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'no-preference'}]});
  await expect(page.locator('html')).toHaveAttribute('data-material-effects','on');
  await page.evaluate(()=>window.aeroPreview.dispose());
  await page.emulateMedia({media:'print'});await expect(page.locator('body')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('body')).toHaveCSS('background-image','none');await page.emulateMedia({media:'screen'});
  await tab(page,'Cores');await page.locator('[data-palette-choice="editorial"]').click();
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage)).not.toContain('37px');
  await expect(page.locator('.palette-choice--frutiger-aero .palette-choice__preview span').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
});
