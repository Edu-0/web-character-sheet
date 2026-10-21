import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEntryEditorScope, entryEditorKey} from '../../js/engine/entry-editor-scope.js';

const character = id => ({meta:{id, system:'test'}});
test('same-sheet remount transfers the editor and final disposal closes it once', async () => {
  const host={}, system={}, bindings=[];
  let closed=0;
  const first=createEntryEditorScope(host, character('one'), system);
  const untrack=first.track('list', {bind:b=>bindings.push(b), close:()=>{closed++;untrack();}});
  first.destroy();
  const second=createEntryEditorScope(host, character('one'), system);
  const binding={owner:'new list'};
  second.bind('list', binding);
  await Promise.resolve();
  assert.equal(closed,0);
  assert.deepEqual(bindings,[null,binding]);
  second.destroy();await Promise.resolve();
  assert.equal(closed,1);
});
test('another character or system cannot inherit the pending editor', () => {
  for(const change of ['character','system']){
    const host={},system={};let closed=0;
    const first=createEntryEditorScope(host, character('one'), system);
    const untrack=first.track('list',{bind:()=>{},close:()=>{closed++;untrack();}});
    first.destroy();
    createEntryEditorScope(host,character(change==='character'?'two':'one'),change==='system'?{}:system);
    assert.equal(closed,1);
  }
});
test('missing or changed list stays suspended and anonymous characters use object identity', () => {
  const host={},model={},system={};let bound,closed=0;
  const first=createEntryEditorScope(host, model, system);
  const key=entryEditorKey({field:'items',itemSchema:{name:{type:'text'}}});
  const untrack=first.track(key,{bind:b=>bound=b,close:()=>{closed++;untrack();}});
  const second=createEntryEditorScope(host,model,system);
  second.bind(entryEditorKey({field:'items',itemSchema:{name:{type:'textarea'}}}),{});
  assert.equal(bound,null);
  createEntryEditorScope(host,{},system);
  assert.equal(closed,1);
});

test('shared data with different permissions or component definitions cannot inherit another list editor', () => {
  const base={field:'items',itemSchema:{name:{type:'text'}}};
  assert.notEqual(entryEditorKey(base),entryEditorKey({...base,disabledWhen:{field:'locked',equals:true}}));
  assert.notEqual(entryEditorKey({...base,entryEditorIdentity:{...base,label:'One'}}),entryEditorKey({...base,entryEditorIdentity:{...base,label:'Two'}}));
});
