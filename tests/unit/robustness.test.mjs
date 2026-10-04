import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectJson, readJsonFile, LIMITS } from '../../js/validation/limits.js';
import { getByPath, setByPath } from '../../js/engine/paths.js';
import { evaluate } from '../../js/engine/formula.js';

// Mesmas fronteiras antes exercitadas via page.evaluate; sem DOM nem storage.
test('limites de bytes antes da leitura, profundidade, coleções e strings', async () => {
  let read=false;
  await assert.rejects(readJsonFile({size:LIMITS.characterBytes+1,text:async()=>{read=true;return '{}';}},LIMITS.characterBytes,'character'), /2 MiB/);
  assert.equal(read,false);
  const deep={}; let cursor=deep;
  for(let i=0;i<34;i++){cursor.next={};cursor=cursor.next;}
  assert.match(inspectJson(deep,'character')[0].path,/character.next/);
  assert.match(inspectJson(deep,'character')[0].message,/profundidade/);
  assert.equal(inspectJson({items:Array(10001).fill(0)},'character')[0].path,'character.items');
  assert.equal(inspectJson({notes:'x'.repeat(100001)},'character')[0].path,'character.notes');
  assert.deepEqual(inspectJson({notes:'x'.repeat(100000),items:Array(10000).fill(0)},'character'),[]);
});
test('caminhos rejeitam herança, vazios e segmentos reservados',()=>{
  for(const path of ['__proto__.x','constructor.prototype.x','a..b','']) for(const fn of [getByPath,setByPath]) assert.throws(()=>fn({},path,1));
  const target=Object.create({inherited:1});setByPath(target,'own.0.value',9);
  assert.equal(getByPath(target,'inherited'),undefined);
  assert.equal(getByPath(target,'own.0.value'),9);
  assert.equal(Object.hasOwn(Object.prototype,'x'),false);
});
test('fórmulas: EOF, whitelist, valores finitos e orçamento sem RangeError',()=>{
  for(const expression of ['1 2','1.2.3','toString()','constructor()','__proto__.x','1/0','sqrt(-1)','('.repeat(100)+'1'+')'.repeat(100),'1+'.repeat(100)+'1','1'.repeat(4097)]) assert.throws(()=>evaluate(expression),error=>!!error.message && error.name!=='RangeError');
  assert.equal(evaluate('if(score >= 10, floor((score - 10) / 2), -1)',{vars:{score:15}}),2);
  assert.equal(evaluate('true && !false'),true);
});
