import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {buildSite} from '../../scripts/build-site.mjs';

test('static distribution contains a complete verifiable app, licenses and no repository/private files',async t=>{
  const parent=await mkdtemp(join(tmpdir(),'ficha-static-test-'));
  t.after(async()=>{assert.equal(dirname(parent),tmpdir());assert.ok(basename(parent).startsWith('ficha-static-test-'));await rm(parent,{recursive:true,force:true});});
  const first=await buildSite({parent}),second=await buildSite({parent});
  assert.notEqual(first.directory,second.directory);
  const info=JSON.parse(await readFile(join(first.directory,'build-info.json'),'utf8'));
  const expected=new Set([...info.assets.map(a=>a.path),...info.guides,'sw.js','LICENSE','THIRD_PARTY_NOTICES.md','assets/artwork/README.md','build-info.json']);
  const actual=[];
  async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await walk(path);else actual.push(relative(first.directory,path).replaceAll('\\','/'));}}
  await walk(first.directory);
  assert.deepEqual(new Set(actual),expected);
  assert.equal(first.count,expected.size);
  assert.ok(info.guides.includes('data/examples/editor-visual.md'));
  assert.ok(info.guides.every(path=>/^data\/examples\/[^/]+$/.test(path)));
  assert.ok(actual.every(p=>!/^\.?git|^docs\/|^tests\/|^tmp\/|^node_modules\/|^package|^fiveserver/.test(p)));
  for(const asset of info.assets){const bytes=await readFile(join(first.directory,asset.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.hash,asset.path);}
  const worker=await readFile(join(first.directory,'sw.js'),'utf8');assert.ok(worker.includes(info.offlineVersion));
  assert.deepEqual(await readFile(join(first.directory,'LICENSE')),await readFile(new URL('../../LICENSE',import.meta.url)));
  assert.deepEqual(await readFile(join(first.directory,'assets/artwork/README.md')),await readFile(new URL('../../assets/artwork/README.md',import.meta.url)));
  assert.equal(JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8')).version,info.version);
});
