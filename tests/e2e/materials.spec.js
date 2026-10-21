import {expect,test} from '@playwright/test';
import {minimalPackage} from '../legacy-editor-package.js';

async function ready(page){await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');}
async function backgroundPanel(page){await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('tab',{name:'Fundo',exact:true}).click();}
async function flush(page){await page.evaluate(async()=>await(await import('/js/write-coordinator.js')).flushLibraryWrites());}
async function openDialog(page){await page.evaluate(async()=>{const {openModal}=await import('/js/modal.js');const content=document.createElement('p');content.textContent='Conteúdo legível, sem desfocar campos ou texto.';openModal({title:'Janela de conferência de material',contentEl:content});});}
async function alpha(locator){return locator.evaluate(el=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(el).backgroundColor;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3]/255;});}

test('três materiais visivelmente distintos, prévia real e redução de efeitos sem perder a escolha',async({page},testInfo)=>{
  await ready(page);await backgroundPanel(page);
  for(const [mode,opacity] of [['solid',1],['translucent',.86],['mega',.48]]){
    await page.locator('#appearance-background-mode').selectOption(mode);
    await expect(page.getByRole('group',{name:'Prévia do material',exact:true})).toBeVisible();
    expect(await alpha(page.locator('.appearance-material-preview__surface'))).toBeCloseTo(opacity,2);
    const button=page.getByRole('button',{name:'Ver janela de exemplo',exact:true});
    await page.mouse.move(0,0);
    await expect.poll(()=>alpha(button)).toBeCloseTo(mode==='mega'?.24:1,2);
    await button.click();const dialog=page.getByRole('dialog',{name:'Prévia do material',exact:true});
    expect(await alpha(dialog)).toBeCloseTo(opacity,2);
    expect(await alpha(dialog.getByLabel('Campo de exemplo'))).toBe(1);
    expect(await alpha(dialog.getByRole('button',{name:'Fechar prévia',exact:true}))).toBe(1);
    await page.screenshot({path:testInfo.outputPath(`${mode}-dialog.png`),animations:'disabled'});
    await page.keyboard.press('Escape');await expect(button).toBeFocused();
  }
  await page.locator('#appearance-reduce-transparency').check();
  expect(await alpha(page.locator('.appearance-material-preview__surface'))).toBe(1);
  await page.getByRole('button',{name:'Ver janela de exemplo',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCSS('backdrop-filter','none');expect(await alpha(page.getByRole('dialog'))).toBe(1);
  await page.keyboard.press('Escape');await expect(page.locator('#appearance-background-mode')).toHaveValue('mega');
  await page.locator('#appearance-reduce-transparency').uncheck();expect(await alpha(page.locator('.appearance-material-preview__surface'))).toBeCloseTo(.48,2);
});

for(const mode of ['translucent','mega'])test(`vidro ${mode} conserva contraste sobre fundos extremos nas seis paletas`,async({page})=>{
  await ready(page);await backgroundPanel(page);await page.locator('#appearance-background-mode').selectOption(mode);
  for(const theme of ['light','dark'])for(const palette of ['classic','editorial','forest','ruby','monochrome','petals']){
    await page.evaluate(async value=>{const ui=await import('/js/theme.js');ui.applyPalette(value.palette);ui.applyTheme(value.theme);},{theme,palette});
    await page.getByRole('button',{name:'Ver janela de exemplo',exact:true}).click();
    const ratios=await page.getByRole('dialog').evaluate(dialog=>{
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
      const lum=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
      // Conservative bound: browser applies the actual backdrop filters to entirely black/white backgrounds.
      return [[dialog,dialog.querySelector('.field span')],[document.querySelector('.shell-nav'),document.querySelector('.shell-nav__item--active')]].flatMap(([surface,label])=>{
        const bg=rgba(getComputedStyle(surface).backgroundColor),fg=rgba(getComputedStyle(label).color),a=bg[3]/255;
        return [0,255].map(base=>{
          const backdrop=document.createElement('canvas');backdrop.width=backdrop.height=512;
          const paint=backdrop.getContext('2d');paint.filter=getComputedStyle(surface).backdropFilter;
          paint.fillStyle=`rgb(${base} ${base} ${base})`;paint.fillRect(0,0,512,512);
          const filtered=paint.getImageData(256,256,1,1).data;
          return contrast(fg,bg.slice(0,3).map((v,i)=>v*a+filtered[i]*(1-a)));
        });
      });
    });
    expect(Math.min(...ratios),`${mode}/${theme}/${palette}`).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press('Escape');
  }
});

for(const theme of ['dark','light'])test(`lápis ${theme} usa o mesmo material, mantém campos opacos e cancela sem gravar`,async({page},testInfo)=>{
  await ready(page);
  await page.evaluate(async()=>{(await import('/js/state.js')).state.setPath('features',[{id:'material-entry',name:'Passo lunar',usesCurrent:2,usesMax:3,description:'Caminha pela luz da lua.'}]);});
  const before=await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()));
  for(const [mode,opacity] of [['solid',1],['translucent',.86],['mega',.48]]){
    await page.setViewportSize({width:1280,height:900});await backgroundPanel(page);
    await page.evaluate(async theme=>{const ui=await import('/js/theme.js');ui.applyPalette('editorial');ui.applyTheme(theme);},theme);
    await page.locator('#appearance-background-mode').selectOption(mode);
    await page.getByRole('button',{name:'Ficha atual',exact:true}).click();
    await page.locator('#generic-sheet-host').getByRole('tab',{name:'Habilidades',exact:true}).click();
    await page.getByRole('button',{name:'Editar Passo lunar',exact:true}).click();
    const dialog=page.locator('dialog.engine-entry-editor[open]');
    expect(await alpha(dialog)).toBeCloseTo(opacity,2);
    expect(await alpha(dialog.getByLabel('Nome',{exact:true}))).toBe(1);
    for(const width of [1280,360]){
      await page.setViewportSize({width,height:900});
      await expect(dialog.getByRole('button',{name:'Cancelar',exact:true})).toBeInViewport();
      await page.screenshot({path:testInfo.outputPath(`${mode}-${theme}-${width}.png`),animations:'disabled'});
    }
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  }
  expect(await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()))).toEqual(before);
  await backgroundPanel(page);await page.locator('#appearance-reduce-transparency').check();
  await page.getByRole('button',{name:'Ficha atual',exact:true}).click();
  await page.getByRole('button',{name:'Editar Passo lunar',exact:true}).click();
  const dialog=page.locator('dialog.engine-entry-editor[open]');
  expect(await alpha(dialog)).toBe(1);
  expect(await dialog.evaluate(el=>getComputedStyle(el,'::backdrop').backdropFilter)).toBe('none');
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Editar Passo lunar',exact:true})).toBeFocused();
});

test('mega reduz filtros no celular e cores forçadas retiram vidro também das barras',async({page})=>{
  await ready(page);await backgroundPanel(page);await page.locator('#appearance-background-mode').selectOption('mega');
  await page.setViewportSize({width:360,height:900});
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--material-menu-blur').trim())).toBe('6px');
  await expect(page.locator('.shell-nav')).toHaveCSS('backdrop-filter',/blur\(12px\)/);
  await page.emulateMedia({forcedColors:'active'});
  await expect(page.locator('.shell-nav')).toHaveCSS('backdrop-filter','none');
  await expect(page.locator('.shell-header')).toHaveCSS('backdrop-filter','none');
  await expect(page.locator('.appearance-material-preview__surface')).toHaveCSS('backdrop-filter','none');
  await expect(page.getByRole('button',{name:'Ver janela de exemplo',exact:true})).toHaveCSS('backdrop-filter','none');
  await expect(page.locator('#appearance-background-mode')).toHaveValue('mega');
  await page.emulateMedia({forcedColors:'none'});
  await expect(page.locator('.appearance-material-preview__surface')).toHaveCSS('backdrop-filter',/blur\(12px\)/);
});

test('fundo persiste nas preferências e backup, sem entrar no personagem ou pacote',async({page})=>{
  await ready(page);await backgroundPanel(page);await expect(page.locator('#appearance-background-mode')).toHaveValue('solid');
  await expect(page.locator('#appearance-background-mode option')).toHaveText(['Sólido','Translúcido','Mega translúcido · experimental']);
  await expect(page.locator('#appearance-browser-hint')).toHaveCount(0);
  const before=await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()));
  for(const mode of ['translucent','mega','solid']){
    await page.locator('#appearance-background-mode').selectOption(mode);await flush(page);
    await expect(page.locator('html')).toHaveAttribute('data-background',mode);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:settings')).backgroundMode)).toBe(mode);
  }
  await page.locator('#appearance-background-mode').selectOption('mega');await page.locator('#appearance-reduce-transparency').check();await flush(page);
  const backup=await page.evaluate(async()=>{const {exportLibrary}=await import('/js/library-backup.js');return exportLibrary();});
  expect(backup.preferences.backgroundMode).toBe('mega');expect(backup.preferences.reduceTransparency).toBe(true);
  expect(backup.characters.every(character=>!Object.hasOwn(character,'backgroundMode')&&!Object.hasOwn(character,'reduceTransparency'))).toBe(true);
  expect(await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()))).toEqual(before);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-background','mega');await expect(page.locator('html')).toHaveAttribute('data-material-effects','off');
  await backgroundPanel(page);await page.locator('#appearance-background-mode').selectOption('solid');await page.locator('#appearance-reduce-transparency').uncheck();await flush(page);
  await expect(page.locator('html')).toHaveAttribute('data-material-effects','on');
});

test('preferência local e backup antigos de navegador transparente usam sólido sem alterar os demais dados',async({page})=>{
  await ready(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  expect(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const before=await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()));
  await page.evaluate(async()=>{
    const storage=await import('/js/storage.js');
    await storage.saveSettings({...storage.loadSettings(),backgroundMode:'browser',reduceTransparency:true,theme:'dark',palette:'petals'});
  });
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await backgroundPanel(page);await expect(page.locator('#appearance-background-mode')).toHaveValue('solid');
  await expect(page.locator('html')).toHaveAttribute('data-background','solid');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('#appearance-reduce-transparency')).toBeChecked();
  const backup=await page.evaluate(async()=>{const {exportLibrary}=await import('/js/library-backup.js');return exportLibrary();});
  expect(backup.preferences.backgroundMode).toBe('browser');
  await page.locator('#appearance-background-mode').selectOption('translucent');await flush(page);
  await page.evaluate(async backup=>{await(await import('/js/library-backup.js')).restoreLibrary(backup,{mode:'replace',confirmed:true});},backup);
  await page.reload();await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  await backgroundPanel(page);await expect(page.locator('#appearance-background-mode')).toHaveValue('solid');
  await expect(page.locator('html')).toHaveAttribute('data-background','solid');
  await expect(page.locator('html')).toHaveAttribute('data-material-effects','off');
  const after=await page.evaluate(async()=>({character:(await import('/js/state.js')).state.get(),settings:(await import('/js/storage.js')).loadSettings()}));
  expect(after.character).toEqual(before);expect(after.settings.palette).toBe('petals');expect(after.settings.theme).toBe('dark');
  await page.locator('#appearance-background-mode').selectOption('translucent');await flush(page);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:settings')).backgroundMode)).toBe('translucent');
});

test('blur temporário, redução manual/dispositivo, teclado e movimento reduzido',async({page,context})=>{
  await ready(page);await backgroundPanel(page);await page.locator('#appearance-background-mode').selectOption('translucent');
  await openDialog(page);const overlay=page.locator('.modal-overlay:not([hidden])');
  await expect(overlay).toHaveCSS('backdrop-filter',/blur\(/);await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(overlay).toHaveCount(0);
  await page.locator('#appearance-reduce-transparency').check();await openDialog(page);await expect(overlay).toHaveCSS('backdrop-filter','none');await page.keyboard.press('Escape');
  await page.locator('#appearance-reduce-transparency').uncheck();
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  await expect(page.locator('html')).toHaveAttribute('data-material-effects','off');await expect(page.locator('#appearance-reduce-transparency')).not.toBeChecked();await openDialog(page);await expect(overlay).toHaveCSS('backdrop-filter','none');await page.keyboard.press('Escape');
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'no-preference'}]});await expect(page.locator('html')).toHaveAttribute('data-material-effects','on');
  await page.emulateMedia({reducedMotion:'reduce'});await openDialog(page);await expect(page.getByRole('dialog')).toHaveCSS('animation-name','none');await page.keyboard.press('Escape');
});

test('prévia recebe materiais ao montar e atualizar, mantém fundo próprio e tema local',async({page})=>{
  await ready(page);await backgroundPanel(page);
  const pkg=minimalPackage('material-preview');
  await page.evaluate(async pkg=>{const host=document.createElement('div');host.id='material-preview';document.body.append(host);window.materialPreview=new(await import('/js/editor/preview-host.js')).PreviewHost(host);await window.materialPreview.mount(pkg,{revision:1,layoutId:pkg.layouts[0].id,appearance:{theme:'light',palette:'editorial'}});},pkg);
  const frame=page.frameLocator('#material-preview iframe:not([hidden])');await expect(frame.locator('html')).toHaveAttribute('data-background','solid');await expect(frame.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('#appearance-background-mode').selectOption('translucent');await expect(frame.locator('html')).toHaveAttribute('data-background','translucent');await expect(frame.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('#appearance-background-mode').selectOption('mega');await expect(frame.locator('html')).toHaveAttribute('data-background','mega');
  await page.locator('#appearance-reduce-transparency').check();await expect(frame.locator('html')).toHaveAttribute('data-material-effects','off');
  await page.evaluate(()=>window.materialPreview.appearance({theme:'dark'}));await expect(frame.locator('html')).toHaveAttribute('data-theme','dark');
  await page.locator('#appearance-background-mode').selectOption('solid');await expect(frame.locator('html')).toHaveAttribute('data-background','solid');await expect(frame.locator('html')).toHaveAttribute('data-theme','dark');
  await page.evaluate(()=>window.materialPreview.dispose());await expect(page.locator('#material-preview iframe')).toHaveCount(0);
});

test('fallback sem regras de filtro conserva superfícies sólidas e diálogo legível',async({page})=>{
  await ready(page);
  // Emula o ramo CSS sem @supports; não certifica um navegador antigo real.
  await page.evaluate(()=>{
    const sheet=[...document.styleSheets].find(sheet=>sheet.href?.endsWith('/css/materials.css'));
    for(const media of [...sheet.cssRules])if(media.cssRules)for(let i=media.cssRules.length-1;i>=0;i--)if(media.cssRules[i] instanceof CSSSupportsRule)media.deleteRule(i);
  });
  await openDialog(page);await expect(page.locator('.modal-overlay:not([hidden])')).toHaveCSS('backdrop-filter','none');
  const surface=await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(surface).toMatch(/^rgb\(/);await page.keyboard.press('Escape');
});

for(const mode of ['solid','translucent','mega'])test(`fundo ${mode} mantém leitura e impressão independente, 320–1440`,async({page},testInfo)=>{
  await ready(page);await backgroundPanel(page);
  await page.locator('#appearance-background-mode').selectOption(mode);
  for(const theme of ['light','dark'])for(const palette of ['classic','editorial','forest','ruby','monochrome','petals']){
    await page.evaluate(async value=>{const ui=await import('/js/theme.js');ui.applyPalette(value.palette);ui.applyTheme(value.theme);},{theme,palette});
    for(const width of [320,360,768,1024,1280,1440]){
      await page.setViewportSize({width,height:900});
      expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(palette==='petals'&&[360,1280].includes(width))await page.screenshot({path:testInfo.outputPath(`${mode}-${theme}-${width}.png`)});
    }
  }
  await page.emulateMedia({media:'print'});await expect(page.locator('body')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.emulateMedia({media:'screen'});expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await page.locator('#appearance-background-mode').selectOption('solid');expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});
