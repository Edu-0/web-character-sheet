import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commitRenderedChanges} from '../../js/engine/render-projection.js';
test('projeção pós-instalação escreve só alterações explícitas, preserva ausência/null e conflitos',()=>{
  const actual={meta:{id:'test'},nil:null,zero:0,off:false,empty:'',opaque:{keep:1}},original=structuredClone(actual);
  const before={...structuredClone(actual),missingList:[],newDefault:7},after=structuredClone(before);after.zero=4;
  commitRenderedChanges(actual,original,before,after);assert.deepEqual(actual,{...original,zero:4});
  after.missingList.push({name:'Novo'});commitRenderedChanges(actual,actual,before,after);assert.deepEqual(actual.missingList,[{name:'Novo'}]);assert.ok(!Object.hasOwn(actual,'newDefault'));
  const concurrent=structuredClone(original);concurrent.zero=9;assert.throws(()=>commitRenderedChanges(concurrent,original,before,after),/mudou/);assert.equal(concurrent.zero,9);
});
