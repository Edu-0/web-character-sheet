import {test,expect} from '@playwright/test';
import {minimalPackage} from '../legacy-editor-package.js';
const themes=['pride','trans','blood','eldritch','scifi','parchment','ocean','solarpunk','frutiger-aero'];
const errorsByPage=new WeakMap();
const settings=async page=>{await page.getByRole('button',{name:'Configurações',exact:true}).click();};
const tab=(page,name)=>page.getByRole('tab',{name,exact:true}).click();
const flush=page=>page.evaluate(async()=>{await(await import('/js/write-coordinator.js')).flushLibraryWrites();});
test.beforeEach(async({page})=>{
  const errors=[];errorsByPage.set(page,errors);page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
});
test.afterEach(async({page})=>expect(errorsByPage.get(page)).toEqual([]));
async function tokenContrast(page){return page.evaluate(()=>{
  const root=getComputedStyle(document.documentElement),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const color=name=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=root.getPropertyValue('--color-'+name);ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
  const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  const backgrounds=['bg','panel','panel-alt','input'].map(color);
  return {text:Math.min(...['text','text-muted','text-faint','accent-strong'].flatMap(name=>backgrounds.map(bg=>ratio(color(name),bg)))),controls:Math.min(...['input-border','choice-border','focus'].flatMap(name=>backgrounds.map(bg=>ratio(color(name),bg)))),primary:ratio(color('accent'),color('accent-contrast')),semantic:Math.min(...['success','info','danger','danger-strong'].flatMap(name=>backgrounds.map(bg=>ratio(color(name),bg)))),dangerButton:Math.min(...['danger','danger-strong'].map(name=>ratio(color(name),color('danger-contrast'))))};
});}

for(const palette of ['high-contrast','colorblind'])test(`${palette}: leitura, escolhas e teclado em claro/escuro e no celular`,async({page},info)=>{
  const before=await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()));
  await settings(page);await tab(page,'Cores');await page.locator(`[data-palette-choice='${palette}']`).click();
  await expect(page.locator('#appearance-theme-artwork')).toBeHidden();
  for(const mode of ['dark','light']){
    await page.locator('#appearance-mode').selectOption(mode);
    const contrast=await tokenContrast(page);
    expect(contrast.text).toBeGreaterThanOrEqual(palette==='high-contrast'?7:4.5);
    expect(contrast.controls).toBeGreaterThanOrEqual(3);expect(contrast.primary).toBeGreaterThanOrEqual(4.5);
    expect(contrast.semantic).toBeGreaterThanOrEqual(palette==='high-contrast'?7:4.5);expect(contrast.dangerButton).toBeGreaterThanOrEqual(4.5);
    const chosen=page.locator(`[data-palette-choice='${palette}']`);await chosen.focus();await page.keyboard.press('Tab');
    expect(await page.evaluate(()=>{const css=getComputedStyle(document.activeElement);return css.outlineStyle!=='none'&&parseFloat(css.outlineWidth)>0;})).toBe(true);
    await page.getByRole('button',{name:'Ficha atual',exact:true}).click();
    for(const width of [1280,360]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:info.outputPath(`${palette}-${mode}-${width}.png`),animations:'disabled'});
    }
    await settings(page);await tab(page,'Cores');
  }
  expect(await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()))).toBe(before);
  await flush(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-palette',palette);
});

test('alto contraste suspende vidro sem perder preferências e respeita a paleta local da prévia',async({page})=>{
  await settings(page);await tab(page,'Fundo');await page.locator('#appearance-background-mode').selectOption('mega');
  await page.locator('#appearance-glass-tint').selectOption('azure');
  await tab(page,'Cores');await page.locator('[data-palette-choice="high-contrast"]').click();await tab(page,'Fundo');
  await expect(page.locator('#appearance-glass-tint')).toBeDisabled();await expect(page.locator('#appearance-material-status')).toContainText('Alto contraste usa superfícies opacas');
  const surface=page.locator('.appearance-material-preview__surface');
  const material=locator=>locator.evaluate(el=>{const css=getComputedStyle(el);return {bg:css.backgroundColor,filter:css.backdropFilter,image:css.backgroundImage};});
  const opaque=await material(surface);expect(opaque.filter).toBe('none');expect(opaque.image).toBe('none');expect(opaque.bg).toBe('rgb(13, 13, 13)');
  await page.locator('#appearance-preview-open').click();expect(await material(page.getByRole('dialog',{name:'Prévia do material',exact:true}))).toEqual(opaque);
  await page.getByRole('button',{name:'Fechar prévia',exact:true}).click();
  await page.evaluate(async pkg=>{
    const host=document.createElement('div');host.id='contrast-preview';document.body.append(host);
    window.contrastPreview=new(await import('/js/editor/preview-host.js')).PreviewHost(host);
    await window.contrastPreview.mount(pkg,{revision:1,layoutId:pkg.layouts[0].id,appearance:{theme:'dark',palette:'ocean'}});
  },minimalPackage('contrast-preview'));
  const frame=page.frameLocator('#contrast-preview iframe:not([hidden])');
  await expect(frame.locator('html')).toHaveAttribute('data-palette','ocean');
  await frame.locator('body').evaluate(el=>{const surface=document.createElement('div');surface.className='appearance-material-preview__surface';el.append(surface);});
  expect((await material(frame.locator('.appearance-material-preview__surface'))).filter).not.toBe('none');
  await frame.locator('html').evaluate(el=>el.dataset.palette='high-contrast');
  expect(await material(frame.locator('.appearance-material-preview__surface'))).toEqual(opaque);
  await tab(page,'Cores');await page.locator('[data-palette-choice="ocean"]').click();await tab(page,'Fundo');
  await expect(page.locator('#appearance-glass-tint')).toBeEnabled();await expect(page.locator('#appearance-glass-tint')).toHaveValue('azure');
  await expect(page.locator('#appearance-background-mode')).toHaveValue('mega');expect((await material(surface)).filter).not.toBe('none');
  expect(await material(frame.locator('.appearance-material-preview__surface'))).toEqual(opaque);
  await page.evaluate(()=>window.contrastPreview.dispose());
});

for(const palette of themes)test(`${palette}: paleta, combinação própria e leitura em claro/escuro no desktop e celular`,async({page},info)=>{
  const before=await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()));
  await settings(page);await tab(page,'Cores');
  await expect(page.locator('[data-palette-choice]')).toHaveCount(17);
  const artwork=await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:settings')).artwork);
  await page.locator(`[data-palette-choice='${palette}']`).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:settings')).artwork)).toEqual(artwork);
  await page.locator('#appearance-theme-ornaments').click();
  await expect(page.locator('#sheet-ornaments svg')).toHaveCount(3);
  for(const mode of ['dark','light']){
    await settings(page);await tab(page,'Cores');await page.locator('#appearance-mode').selectOption(mode);
    const contrast=await tokenContrast(page);
    expect(contrast.text,`${palette}/${mode} text`).toBeGreaterThanOrEqual(4.5);
    expect(contrast.controls,`${palette}/${mode} controls`).toBeGreaterThanOrEqual(3);
    expect(contrast.primary,`${palette}/${mode} primary`).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button',{name:'Ficha atual',exact:true}).click();
    for(const width of [1280,360]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
      await expect(page.locator('#sheet-ornaments')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:info.outputPath(`${palette}-${mode}-${width}.png`),animations:'disabled'});
    }
  }
  expect(await page.evaluate(async()=>JSON.stringify((await import('/js/state.js')).state.get()))).toBe(before);
  await flush(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-palette',palette);
  await expect(page.locator('#sheet-ornaments svg')).toHaveCount(3);
  const ids=await page.locator('#sheet-ornaments [data-ornament]').evaluateAll(nodes=>nodes.map(node=>node.dataset.ornament));
  expect(ids.every(id=>id.startsWith(palette+'-'))).toBe(true);
});

test('tintura persiste e acompanha prévia isolada, sem entrar nos dados da ficha ou perder a redução',async({page})=>{
  await settings(page);await tab(page,'Fundo');await expect(page.locator('#appearance-glass-tint')).toBeDisabled();
  await page.locator('#appearance-background-mode').selectOption('mega');
  await page.locator('#appearance-glass-strength').selectOption('strong');
  await page.locator('#appearance-glass-tint').selectOption('rose');
  const rose=await page.locator('.appearance-material-preview__surface').evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.locator('#appearance-glass-tint').selectOption('azure');
  expect(await page.locator('.appearance-material-preview__surface').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(rose);
  await page.evaluate(async pkg=>{const host=document.createElement('div');host.id='tinted-preview';document.body.append(host);window.tintedPreview=new(await import('/js/editor/preview-host.js')).PreviewHost(host);await window.tintedPreview.mount(pkg,{revision:1,layoutId:pkg.layouts[0].id,appearance:{theme:'light',palette:'scifi'}});},minimalPackage('tinted-preview'));
  const frame=page.frameLocator('#tinted-preview iframe:not([hidden])');
  await expect(frame.locator('html')).toHaveAttribute('data-glass-tint','azure');await expect(frame.locator('html')).toHaveAttribute('data-glass-tint-strength','strong');
  await page.locator('#appearance-glass-tint').selectOption('crimson');
  await expect(frame.locator('html')).toHaveAttribute('data-glass-tint','crimson');await expect(frame.locator('html')).toHaveAttribute('data-palette','scifi');
  await page.locator('#appearance-reduce-transparency').check();await expect(page.locator('#appearance-glass-tint')).toBeDisabled();
  await expect(frame.locator('html')).toHaveAttribute('data-material-effects','off');await expect(frame.locator('html')).toHaveAttribute('data-glass-tint','crimson');
  await page.locator('#appearance-reduce-transparency').uncheck();await page.locator('#appearance-glass-tint').selectOption('neutral');
  await expect(page.locator('#appearance-glass-strength')).toBeDisabled();
  await page.locator('#appearance-glass-tint').selectOption('crimson');await flush(page);
  const backup=await page.evaluate(async()=>(await import('/js/library-backup.js')).exportLibrary());
  expect(backup.preferences.glassTint).toBe('crimson');expect(backup.preferences.glassTintStrength).toBe('strong');
  expect(backup.characters.every(character=>!Object.hasOwn(character,'glassTint'))).toBe(true);
  await page.evaluate(()=>window.tintedPreview.dispose());await page.reload();await settings(page);await tab(page,'Fundo');
  await expect(page.locator('#appearance-glass-tint')).toHaveValue('crimson');await expect(page.locator('#appearance-glass-strength')).toHaveValue('strong');
});

for(const palette of ['classic','editorial','forest','ruby','monochrome','petals',...themes,'colorblind','high-contrast'])test(`${palette}: todas as tinturas intensas conservam leitura no vidro`,async({page})=>{
  await settings(page);await tab(page,'Fundo');await page.locator('#appearance-background-mode').selectOption('mega');
  await page.locator('#appearance-glass-strength').selectOption('strong');
  const min=await page.evaluate(async palette=>{
    const ui=await import('/js/theme.js');ui.applyPalette(palette);
    const surface=document.querySelector('.appearance-material-preview__surface'),label=surface.querySelector('p');
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),filtered=new Map();
    const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
    const lum=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    let lowest={ratio:Infinity};
    for(const theme of ['light','dark'])for(const mode of ['translucent','mega'])for(const tint of ['palette','neutral','rose','azure','emerald','crimson','violet']){
      ui.applyTheme(theme);Object.assign(document.documentElement.dataset,{background:mode,glassTint:tint,glassTintStrength:'strong'});
      const css=getComputedStyle(surface),bg=rgba(css.backgroundColor),fg=rgba(getComputedStyle(label).color),alpha=bg[3]/255;
      if(!filtered.has(css.backdropFilter))filtered.set(css.backdropFilter,[0,255].map(base=>{const c=document.createElement('canvas');c.width=c.height=512;const p=c.getContext('2d');p.filter=css.backdropFilter;p.fillStyle=`rgb(${base} ${base} ${base})`;p.fillRect(0,0,512,512);return [...p.getImageData(256,256,1,1).data];}));
      const sheen=rgba(getComputedStyle(document.documentElement).getPropertyValue('--material-sheen'));
      for(const base of filtered.get(css.backdropFilter)){
        const composite=bg.slice(0,3).map((v,i)=>v*alpha+base[i]*(1-alpha));
        const current=Math.min(ratio(fg,composite),ratio(fg,composite.map((v,i)=>sheen[i]*sheen[3]/255+v*(1-sheen[3]/255))));
        if(current<lowest.ratio)lowest={ratio:current,theme,mode,tint,filter:css.backdropFilter};
      }
    }
    return lowest;
  },palette);
  expect(min.ratio,JSON.stringify(min)).toBeGreaterThanOrEqual(4.5);
});
