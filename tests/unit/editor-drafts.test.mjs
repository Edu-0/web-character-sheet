import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditorSession} from '../../js/editor/session.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {encodeDraft,decodeDraft,saveDraft,readDraft,listDrafts,deleteDraft,DRAFT_PREFIX} from '../../js/editor/draft-repository.js';
const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>{store.set(key,value);Object.defineProperty(localStorage,key,{value,enumerable:true,configurable:true});},removeItem:key=>{store.delete(key);delete localStorage[key];}};
// Browser locking is exercised by Playwright. Node's experimental LockManager
// is not the persistence adapter under test here.
Object.defineProperty(navigator,'locks',{value:{request:async(name,operation)=>operation({name})},configurable:true});
test('rascunho deduplica última válida, preserva inválido e revalida snapshot',()=>{
  const session=new EditorSession({text:JSON.stringify(minimalPackage('draft-test'))});
  const raw=encodeDraft(session.envelope());assert.ok(raw.includes('sameText'));assert.ok(!raw.includes('"package":'));
  assert.deepEqual(decodeDraft(raw).lastValid.package,session.lastValid.package);
  session.replaceText('{ broken');session.validate();const restored=decodeDraft(encodeDraft(session.envelope()));assert.equal(restored.text,'{ broken');assert.equal(restored.lastValid.revision,0);
  const reopened=new EditorSession(restored);assert.equal(reopened.history.undoStack.length,0);assert.equal(reopened.lastValid.package.system.id,'draft-test');
});
test('rascunhos corrompidos/futuros não são sobrescritos; save compara bruto',async()=>{
  const session=new EditorSession({text:JSON.stringify(minimalPackage('draft-save'))});
  const raw=await saveDraft(session.envelope());assert.equal(readDraft(session.draftId),raw);
  await assert.rejects(saveDraft(session.envelope(),null),/outra aba/);
  const future='{"kind":"rpg-editor-draft","schemaVersion":99}';localStorage.setItem(DRAFT_PREFIX+'future',future);
  const unavailable=listDrafts().find(entry=>entry.key.endsWith('future'));assert.equal(unavailable.raw,future);assert.ok(unavailable.error);
  await assert.rejects(deleteDraft(DRAFT_PREFIX+'future','changed'),/mudou/);assert.equal(readDraft('future'),future);
  await deleteDraft(DRAFT_PREFIX+'future',future);assert.equal(readDraft('future'),null);
});
