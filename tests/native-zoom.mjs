import {chromium,expect} from '@playwright/test';
import {startStaticServer} from './static-server.mjs';
import {minimalPackage} from './legacy-editor-package.js';
import {editorArea,editorTool} from './helpers/editor-workspace-nav.js';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const output=new URL('../output/',import.meta.url);await mkdir(output,{recursive:true});
const directory=await mkdtemp(fileURLToPath(new URL('native-zoom-',output)));
const root=pathToFileURL(directory+'/'),server=await startStaticServer(0);
const origin='http://127.0.0.1:'+server.address().port;
const extension=fileURLToPath(new URL('./fixtures/native-zoom/',import.meta.url));
const context=await chromium.launchPersistentContext(fileURLToPath(new URL('zoom-profile',root)),{channel:'msedge',headless:false,viewport:null,ignoreDefaultArgs:['--disable-extensions'],args:['--window-size=1440,1000','--disable-extensions-except='+extension,'--load-extension='+extension]});
try{
 const page=await context.newPage();
 await page.goto(origin);await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
 const pkg=minimalPackage('release-native-zoom');
 for(let i=0;i<60;i++)pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'text',field:'memo'+i,label:'Nota '+i});
 await page.getByRole('button',{name:'Sistemas',exact:true}).click();
 await page.locator('#input-editor-file').setInputFiles({name:'zoom.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});
 await expect(page.locator('#editor-preview-status')).toContainText('Ensaio da revisão',{timeout:20000});await editorArea(page,'sheet');
 await page.evaluate(()=>document.title='E80 — Zoom nativo 200%');
 const background=context.serviceWorkers().find(w=>w.url().endsWith('/zoom.js')) || await context.waitForEvent('serviceworker',{predicate:w=>w.url().endsWith('/zoom.js'),timeout:20000});
 const tabId=await background.evaluate(async origin=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.startsWith(origin+'/'));await chrome.tabs.setZoom(tab.id,1);return tab.id;},origin);
 await page.waitForFunction(()=>innerWidth>1000);
 const before=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,zoom:getComputedStyle(document.documentElement).zoom}));
 console.log('READY',JSON.stringify(before));
 const factor=await background.evaluate(async id=>{await chrome.tabs.setZoom(id,2);return chrome.tabs.getZoom(id);},tabId);
 expect(factor).toBe(2);await page.waitForFunction(()=>innerWidth<1000);
 const after=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,zoom:getComputedStyle(document.documentElement).zoom,scale:visualViewport.scale}));
 expect(after.dpr/before.dpr).toBeCloseTo(2,1);expect(after.zoom).toBe('1');expect(after.scale).toBe(1);
 const geometry=[];
 for(const theme of ['light','dark']){
  await page.locator('button[data-workspace-panel="canvas"]').click();
  await expect(page.locator('.editor-preview-frame:not([hidden])')).toBeVisible();
  await page.evaluate(async t=>{const m=await import('/js/theme.js');m.applyTheme(t);},theme);
  // Preview appearance is independent from the shell. Set both test surfaces;
  // the preview-theme selector itself is covered by the regular browser suite.
  await page.frameLocator('.editor-preview-frame:not([hidden])').locator('html').evaluate((html,t)=>html.dataset.theme=t,theme);
  await expect(page.frameLocator('.editor-preview-frame:not([hidden])').locator('html')).toHaveAttribute('data-theme',theme);
  const frame=page.frameLocator('.editor-preview-frame:not([hidden])');
  for(const i of [0,30,59]){
   await page.locator('button[data-workspace-panel="canvas"]').click();
   await expect(page.locator('#view-editor')).toHaveAttribute('data-workspace-panel','canvas');
   await expect(page.locator('.editor-preview-frame:not([hidden])')).toBeVisible();
   const bounds=await page.locator('.editor-preview-frame:not([hidden])').boundingBox();
   expect(bounds.height).toBeGreaterThan(100);
   expect(bounds.y+bounds.height).toBeLessThanOrEqual(after.height+1);
   await frame.getByLabel('Nota '+i,{exact:true}).scrollIntoViewIfNeeded();
   await editorTool(page,'add');await expect(page.locator('.editor-toolbox')).toBeVisible();
   await page.locator('button[data-workspace-panel="canvas"]').click();
   await frame.getByLabel('Nota '+i,{exact:true}).click();
   await expect(page.locator('.workspace-properties')).toBeVisible();
   await expect(page.locator('.workspace-properties').getByLabel('Rótulo',{exact:true})).toHaveValue('Nota '+i);
   await page.locator('button[data-workspace-panel="canvas"]').click();
   geometry.push(await page.evaluate(()=>({theme:document.documentElement.dataset.theme,width:innerWidth,height:innerHeight,overflowX:document.documentElement.scrollWidth-innerWidth,overflowY:document.documentElement.scrollHeight-innerHeight})));
  }
  for(const area of ['overview','data','rules','test','review','sheet'])await editorArea(page,area);
  await page.locator('button[data-workspace-panel="canvas"]').click();
  await expect(page.locator('.editor-preview-frame:not([hidden])')).toBeVisible();
  await frame.getByLabel('Nota 59',{exact:true}).scrollIntoViewIfNeeded();
  const cdp=await context.newCDPSession(page);
  const capture=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:before.width,height:before.height,scale:1}});
  await writeFile(new URL('native-200-'+theme+'.png',root),Buffer.from(capture.data,'base64'));await cdp.detach();
 }
 await writeFile(new URL('native-zoom.json',root),JSON.stringify({before,after,factor,geometry,passed:true},null,2));console.log('PASSED native 200%',directory);
}finally{await context.close();await new Promise(r=>server.close(r));}
