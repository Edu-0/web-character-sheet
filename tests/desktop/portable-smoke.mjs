import {spawn} from 'node:child_process';
import {mkdtemp,copyFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';

if(!process.env.FICHA_PORTABLE_EXECUTABLE)throw Error('Informe FICHA_PORTABLE_EXECUTABLE com o portátil que deseja testar.');
const directory=await mkdtemp(join(tmpdir(),'ficha-portable-smoke-'));
const executable=join(directory,'Ficha-RPG-portable.exe');
await copyFile(resolve(process.env.FICHA_PORTABLE_EXECUTABLE),executable);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.FICHA_DESKTOP_TEST_PROFILE;
async function open(){
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));
  const child=spawn(executable,[`--remote-debugging-port=${port}`],{env,stdio:'ignore'});
  const deadline=Date.now()+90000;let browser;
  while(Date.now()<deadline){
    try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:1500});break;}catch{await new Promise(resolve=>setTimeout(resolve,400));}
  }
  if(!browser){child.kill();throw Error('O portátil não abriu a porta local de teste em 90s.');}
  const page=browser.contexts()[0].pages()[0];
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)',{timeout:20000});
  return {browser,page,child};
}
let run;
try{
  run=await open();
  await run.page.getByRole('button',{name:'Ficha estática',exact:true}).click();
  await run.page.locator('[data-bind="identity.name"]').fill('Personagem portátil de teste');
  await expect(run.page.locator('#save-indicator')).toHaveText('Salvo',{timeout:5000});
  assert.ok((await stat(join(directory,'Ficha RPG Dados'))).isDirectory());
  await run.page.evaluate(()=>window.close());
  await new Promise(resolve=>run.child.exitCode!==null?resolve():run.child.once('exit',resolve));
  run=await open();
  await run.page.getByRole('button',{name:'Ficha estática',exact:true}).click();
  await expect(run.page.locator('[data-bind="identity.name"]')).toHaveValue('Personagem portátil de teste');
  await run.page.getByRole('button',{name:'Configurações',exact:true}).click();
  await expect(run.page.locator('#offline-status')).toContainText('Windows disponível offline');
  await run.page.evaluate(()=>window.close());
  await new Promise(resolve=>run.child.exitCode!==null?resolve():run.child.once('exit',resolve));
  console.log('Portátil real aprovado: extração, perfil ao lado do exe e personagem preservado após reabrir.');
}finally{await run?.browser.close().catch(()=>{});}
