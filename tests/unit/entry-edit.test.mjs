import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareEntryEdit} from '../../js/engine/entry-edit.js';
import {validateLayout} from '../../js/validation/schemas.js';
import {nodeSchema, propertyGroup, labelFor} from '../../js/editor/form-metadata.js';
import {minimalPackage} from '../legacy-editor-package.js';

test('edição prepara somente campos alterados, mantém identidade, extras e mudanças rápidas concorrentes', () => {
  const original={id:'a',name:'Antes',uses:3,hidden:{source:'book'},zero:0,no:false};
  const draft={...structuredClone(original),name:'Depois'};
  const current={...structuredClone(original),uses:1,hidden:{source:'new'}};
  const next=prepareEntryEdit(current,original,draft,['name','uses','zero','no']);
  assert.deepEqual(next,{...current,name:'Depois'});
  assert.equal(current.name,'Antes');assert.equal(original.name,'Antes');
  draft.hidden.source='mutated';assert.equal(next.hidden.source,'new');
  assert.deepEqual(prepareEntryEdit(current,current,current,['name']),current);
});

test('conflito, remoção e substituição recusam sem mutar; ausência, null e exclusão são distintos', () => {
  const before={id:'a',name:'Antes',note:null},draft={id:'a',name:'Depois'};
  assert.throws(()=>prepareEntryEdit(null,before,draft,['name']),/removida/);
  assert.throws(()=>prepareEntryEdit({id:'b'},before,draft,['name']),/substituída/);
  const current={...before,name:'Terceiro'};
  assert.throws(()=>prepareEntryEdit(current,before,draft,['name']),/também mudou/);
  assert.equal(current.name,'Terceiro');
  assert.throws(()=>prepareEntryEdit({id:'a',name:'Antes'},before,{...before,note:'nota'},['note']),/também mudou/);
  const next=prepareEntryEdit(before,before,draft,['name','note']);assert.equal(next.name,'Depois');assert.ok(!Object.hasOwn(next,'note'));
  const empty={id:'a'};assert.deepEqual(prepareEntryEdit(empty,empty,{id:'b',note:null},['id','note','__proto__','constructor','prototype']),{id:'a',note:null});
});

test('modo de edição é opt-in de list; campos rápidos têm referência validada e autoria por formulário', () => {
  const layout=minimalPackage().layouts[0];
  const component={type:'list',field:'things',label:'Coisas',itemSchema:{name:'text',ready:'boolean'},editMode:'dialog',quickFields:['ready']};
  layout.tabs[0].sections[0].containers[0].components=[component];
  assert.deepEqual(validateLayout(layout),[]);
  const schema=nodeSchema('component',component);assert.deepEqual(schema.editMode.enum,['inline','dialog']);assert.equal(schema.quickFields.items.type,'string');
  assert.equal(propertyGroup('editMode'),'Apresentação');assert.equal(labelFor('quickFields'),'Campos rápidos na ficha');
  for(const bad of [{editMode:'unknown'},{quickFields:['missing']},{quickFields:['ready','ready']},{quickFields:'ready'},{editMode:'inline',quickFields:[]},{type:'table'},{type:'dataField'}]) {
    Object.assign(component,{type:'list',editMode:'dialog',quickFields:['ready']},bad);assert.ok(validateLayout(layout).length,JSON.stringify(bad));
  }
  Object.assign(component,{type:'list'});delete component.editMode;delete component.quickFields;assert.deepEqual(validateLayout(layout),[]);
});
