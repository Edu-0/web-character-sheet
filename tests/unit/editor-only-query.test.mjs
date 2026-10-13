// Cardinality is explicit; a table never supplies an implicit price or entry.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRule,createRuleContext} from '../../js/engine/rule-registry.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
let serial=0;const n=(op,args={})=>({id:'single-'+ ++serial,op,version:1,...args}),lit=value=>n('literal',{value}),d=(id,type,extra={})=>({id,label:id,binding:id,type,required:false,nullable:false,...extra});
const fixture=()=>{const system=minimalPackage('single-table').system;system.catalogs=[{id:'prices',label:'Preços',fields:[d('sides','integer'),d('price','number')],entries:[{id:'d6',sides:6,price:2},{id:'free',sides:4,price:0}]}];system.dataDefinitions=[d('selected','integer'),d('items','collection',{fields:[d('enabled','boolean'),d('modules','collection',{fields:[d('mass','number')]})]})];const character={selected:6,items:[{id:'a',enabled:true,modules:[{id:'ma',mass:4}]},{id:'b',enabled:false,modules:[{id:'mb',mass:7}]}]};return {system,character};};
function rule(expression){return {id:'main',label:'Preço atual',kind:'calculation',revision:1,resultType:'number',expression};}
const priceExpression=()=>n('property',{fieldId:'price',value:n('only',{source:n('filter',{source:n('catalog',{catalogId:'prices'}),predicate:n('equal',{left:n('property',{fieldId:'sides',value:n('item')}),right:n('read',{dataId:'selected'})})})})});

test('AV-10 consulta única diferencia zero declarado, ausência e ambiguidade na tabela atual',()=>{
 const f=fixture();f.system.rules=[rule(priceExpression())];const before=structuredClone(f);assert.equal(evaluateRule(f.system,f.character,'main'),2);assert.deepEqual(f,before);f.character.selected=4;assert.equal(evaluateRule(f.system,f.character,'main'),0);f.character.selected=8;assert.throws(()=>evaluateRule(f.system,f.character,'main'),/exatamente uma.*0/);f.character.selected=6;f.system.catalogs[0].entries.push({id:'other',sides:6,price:3});assert.throws(()=>evaluateRule(f.system,f.character,'main'),/exatamente uma.*2/);
});

test('AV-10 consulta única preserva contexto de entrada para consulta interna e orçamento comum',()=>{
 const f=fixture(),one=n('only',{source:n('filter',{source:n('read',{dataId:'items'}),predicate:n('read',{dataId:'enabled'})})});f.system.rules=[rule(n('sum',{source:n('map',{source:n('property',{fieldId:'modules',value:one}),value:n('read',{dataId:'mass'})})}))];const before=structuredClone(f.character);assert.equal(evaluateRule(f.system,f.character,'main'),4);assert.deepEqual(f.character,before);assert.throws(()=>createRuleContext(f.system,f.character,{budget:{remaining:1}}).evaluate('main'),/limite|orçamento/i);
});

test('AV-10 consulta única não admite listas primitivas, ausência, null ou identidades inválidas',()=>{
 const f=fixture(),expression=n('property',{fieldId:'enabled',value:n('only',{source:n('read',{dataId:'items'})})});
 f.system.rules=[{...rule(expression),resultType:'boolean'}];
 for(const value of [undefined,null,[],[{id:'a',enabled:true},{id:'b',enabled:false}]]){
  if(value===undefined)delete f.character.items;else f.character.items=value;
  assert.throws(()=>evaluateRule(f.system,f.character,'main'),/ausente|nulo|null|exatamente uma/);
 }
 f.character.items=[{enabled:true}];assert.throws(()=>evaluateRule(f.system,f.character,'main'),/identidade/i);
 f.system.rules=[rule(n('count',{source:n('only',{source:n('map',{source:n('catalog',{catalogId:'prices'}),value:n('property',{fieldId:'price',value:n('item')})})})}))];
 assert.throws(()=>evaluateRule(f.system,f.character,'main'),/exige collection/);
 f.system.schemaVersion=2;assert.throws(()=>evaluateRule(f.system,f.character,'main'),/exigem v3/);
});
