import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import runtime from '../../desktop/runtime.cjs';

test('desktop serves only the public manifest, rejects traversal, network origins and stale workers',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'ficha-desktop-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,'js'));
  await writeFile(join(directory,'build-info.json'),JSON.stringify({assets:[{path:'index.html'},{path:'js/app.js'}],guides:[]}));
  await writeFile(join(directory,'index.html'),'<h1>Ficha</h1>');
  await writeFile(join(directory,'js/app.js'),'export const value=1;');
  await writeFile(join(directory,'private.txt'),'secret');
  const handler=await runtime.createPublicHandler(directory);
  const request=(url,method='GET')=>handler({url,method});
  const page=await request('ficha://app/');assert.equal(page.status,200);assert.match(await page.text(),/Ficha/);
  assert.match(page.headers.get('content-security-policy'),/object-src 'none'/);
  assert.equal((await request('ficha://app/js/app.js?x=1')).headers.get('content-type'),'text/javascript; charset=utf-8');
  assert.equal(await (await request('ficha://app/','HEAD')).text(),'');
  assert.equal((await request('ficha://app/','POST')).status,405);
  for(const path of ['private.txt','docs/private/continuidade.md','sw.js','node_modules/electron/package.json','js/%2e%2e%2fprivate.txt','js%5c..%5cprivate.txt','%00'])assert.equal((await request('ficha://app/'+path)).status,404,path);
  for(const url of ['https://app/index.html','ficha://other/index.html','ficha://user@app/index.html','ficha://app:123/index.html','garbage'])assert.equal((await request(url)).status,404,url);
});
