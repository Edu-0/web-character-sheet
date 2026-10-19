import {expect,test} from '@playwright/test';
import {minimalPackage} from '../legacy-editor-package.js';

async function ready(page){await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');}
async function backgroundPanel(page){await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('tab',{name:'Fundo',exact:true}).click();}
async function flush(page){await page.evaluate(async()=>await(await import('/js/write-coordinator.js')).flushLibraryWrites());}
async function openDialog(page){await page.evaluate(async()=>{const {openModal}=await import('/js/modal.js');const content=document.createElement('p');content.textContent='Conteúdo legível, sem desfocar campos ou texto.';openModal({title:'Janela de conferência de material',contentEl:content});});}

test('fundo persiste nas preferências e backup, sem entrar no personagem ou pacote',async({page})=>{
  await ready(page);await backgroundPanel(page);await expect(page.locator('#appearance-background-mode')).toHaveValue('solid');
  await expect(page.locator('#appearance-browser-hint')).toBeHidden();
  const before=await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()));
  for(const mode of ['translucent','browser','solid']){
    await page.locator('#appearance-background-mode').selectOption(mode);await flush(page);
    await expect(page.locator('html')).toHaveAttribute('data-background',mode);
    if(mode==='browser')await expect(page.locator('#appearance-browser-hint')).toBeVisible();
    else await expect(page.locator('#appearance-browser-hint')).toBeHidden();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ficha-rpg:settings')).backgroundMode)).toBe(mode);
  }
  await page.locator('#appearance-background-mode').selectOption('browser');await page.locator('#appearance-reduce-transparency').check();await flush(page);
  const backup=await page.evaluate(async()=>{const {exportLibrary}=await import('/js/library-backup.js');return exportLibrary();});
  expect(backup.preferences.backgroundMode).toBe('browser');expect(backup.preferences.reduceTransparency).toBe(true);
  expect(backup.characters.every(character=>!Object.hasOwn(character,'backgroundMode')&&!Object.hasOwn(character,'reduceTransparency'))).toBe(true);
  expect(await page.evaluate(async()=>structuredClone((await import('/js/state.js')).state.get()))).toEqual(before);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-background','browser');await expect(page.locator('html')).toHaveAttribute('data-material-effects','off');
  await backgroundPanel(page);await page.locator('#appearance-background-mode').selectOption('solid');await page.locator('#appearance-reduce-transparency').uncheck();await flush(page);
  await expect(page.locator('html')).toHaveAttribute('data-material-effects','on');
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
  await ready(page);await backgroundPanel(page);await page.locator('#appearance-background-mode').selectOption('browser');
  const pkg=minimalPackage('material-preview');
  await page.evaluate(async pkg=>{const host=document.createElement('div');host.id='material-preview';document.body.append(host);window.materialPreview=new(await import('/js/editor/preview-host.js')).PreviewHost(host);await window.materialPreview.mount(pkg,{revision:1,layoutId:pkg.layouts[0].id,appearance:{theme:'light',palette:'editorial'}});},pkg);
  const frame=page.frameLocator('#material-preview iframe:not([hidden])');await expect(frame.locator('html')).toHaveAttribute('data-background','solid');await expect(frame.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('#appearance-background-mode').selectOption('translucent');await expect(frame.locator('html')).toHaveAttribute('data-background','translucent');await expect(frame.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('#appearance-reduce-transparency').check();await expect(frame.locator('html')).toHaveAttribute('data-material-effects','off');
  await page.evaluate(()=>window.materialPreview.appearance({theme:'dark'}));await expect(frame.locator('html')).toHaveAttribute('data-theme','dark');
  await page.locator('#appearance-background-mode').selectOption('browser');await expect(frame.locator('html')).toHaveAttribute('data-background','solid');await expect(frame.locator('html')).toHaveAttribute('data-theme','dark');
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

test('página transparente tem proteção de leitura e impressão independente, 320–1440',async({page})=>{
  await ready(page);await backgroundPanel(page);await page.locator('#appearance-background-mode').selectOption('browser');
  for(const theme of ['light','dark'])for(const palette of ['classic','editorial','forest','ruby','monochrome','petals']){
    await page.evaluate(async value=>{const ui=await import('/js/theme.js');ui.applyPalette(value.palette);ui.applyTheme(value.theme);},{theme,palette});
    for(const width of [320,360,768,1024,1280,1440]){
      await page.setViewportSize({width,height:900});
      await expect(page.locator('body')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
      expect(await page.locator('.shell-content').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
  await page.emulateMedia({media:'print'});await expect(page.locator('body')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.emulateMedia({media:'screen'});await expect(page.locator('body')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.locator('#appearance-background-mode').selectOption('solid');expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});
