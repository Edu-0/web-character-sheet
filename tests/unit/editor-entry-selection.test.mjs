import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRule,createRuleContext} from '../../js/engine/rule-registry.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {prepareActionIntent,resolveActionIntent} from '../../js/engine/action-plan.js';
import {prepareActivationMilestone,resumeActionIntent} from '../../js/engine/action-plan.js';
import {applyCharacterChanges} from '../../js/engine/character-history.js';
let serial=0;const n=(op,args={})=>({id:'ordered-'+ ++serial,op,version:1,...args}),lit=value=>n('literal',{value}),d=(id,type,extra={})=>({id,label:id,binding:id,type,required:false,nullable:false,...extra});
function fixture(expression,resultType='string'){
 const system=minimalPackage('entry-order').system;system.dataDefinitions=[d('items','collection',{fields:[d('enabled','boolean'),d('modules','collection',{fields:[d('mass','number')]})]}),d('ordinary','record',{fields:[d('title','string')]})];system.rules=[{id:'main',label:'Seleção declarada',revision:1,kind:'calculation',resultType,expression}];const character={items:[{id:'a',enabled:true,modules:[{id:'ma',mass:4}]},{id:'b',enabled:false,modules:[{id:'mb',mass:7}]}],ordinary:{title:'Texto'}};return {system,character};
}
const first=()=>n('first',{source:n('read',{dataId:'items'})}),identity=value=>n('entryIdentity',{value});
test('AV-10 primeira entrada tem ordem explícita, identidade estável e ausência distinta de zero',()=>{
 const f=fixture(n('ifAbsent',{value:identity(first()),fallback:lit('ausente')})),before=structuredClone(f);assert.equal(evaluateRule(f.system,f.character,'main'),'a');assert.deepEqual(f,before);f.character.items.reverse();assert.equal(evaluateRule(f.system,f.character,'main'),'b');f.character.items=[];assert.equal(evaluateRule(f.system,f.character,'main'),'ausente');delete f.character.items;assert.throws(()=>evaluateRule(f.system,f.character,'main'),/Fonte ausente/);
});
test('AV-10 seleção ordenada conserva contexto aninhado e orçamento do avaliador comum',()=>{
 const f=fixture(n('sum',{source:n('map',{source:n('property',{fieldId:'modules',value:first()}),value:n('read',{dataId:'mass'})})}),'number');assert.equal(evaluateRule(f.system,f.character,'main'),4);assert.throws(()=>createRuleContext(f.system,f.character,{budget:{remaining:1}}).evaluate('main'),/Orçamento/);
});
test('AV-10 identidades vêm somente de entradas válidas; não de registros ou listas primitivas',()=>{
 const ordinary=fixture(identity(n('read',{dataId:'ordinary'})));assert.throws(()=>evaluateRule(ordinary.system,ordinary.character,'main'),/identidade exige entrada/);
 const invalid=fixture(identity(first()));invalid.character.items=[{id:'bad id',enabled:true}];assert.throws(()=>evaluateRule(invalid.system,invalid.character,'main'),/identidade/i);
 invalid.character.items=[{id:'a'},{id:'a'}];assert.throws(()=>evaluateRule(invalid.system,invalid.character,'main'),/duplicada/);
 const primitive=fixture(identity(n('first',{source:n('map',{source:n('read',{dataId:'items'}),value:n('read',{dataId:'enabled'})})})));assert.throws(()=>evaluateRule(primitive.system,primitive.character,'main'),/exige collection/);
});

test('AV-10 resultado de seleção pode ser reutilizado como registro local da mesma ação',()=>{
 const f=fixture(lit(''));f.character.schemaVersion=3;const action={id:'pick',label:'Reusar entrada',flow:{version:1,revision:1,profile:'preview',inputs:[],costs:[],steps:[{id:'chosen',label:'Escolher primeira',type:'value',resultType:'record',expression:first()},{id:'name',label:'Identidade',type:'value',resultType:'string',expression:identity(n('local',{localId:'chosen'}))}]}};
 action.flow.steps.push({id:'mass',label:'Massa aninhada',type:'value',resultType:'number',expression:n('sum',{source:n('map',{source:n('property',{fieldId:'modules',value:n('local',{localId:'chosen'})}),value:n('read',{dataId:'mass'})})})});
 const before=structuredClone(f.character),plan=resolveActionIntent(f.system,f.character,action,prepareActionIntent(f.system,f.character,action));assert.equal(plan.locals.name,'a');assert.equal(plan.locals.mass,4);assert.deepEqual(f.character,before);assert.deepEqual(plan.readings.find(r=>r.dataId==='mass').context.entries,[{dataId:'items',entryId:'a'},{dataId:'modules',entryId:'ma'}]);
});

test('AV-10 contexto de seleção é rederivado ao retomar ativação e não vira estado persistido paralelo',()=>{
 const f=fixture(lit(''));f.system.dataDefinitions.push(d('energy','number'));Object.assign(f.character,{schemaVersion:3,energy:10});const action={id:'paid',label:'Seleção paga',flow:{version:1,revision:1,profile:'activation',inputs:[],costs:[{id:'cost',label:'Custo aninhado',dataId:'energy',amount:n('local',{localId:'mass'}),mode:'remaining',stage:'activation',when:'always'}],steps:[{id:'chosen',label:'Primeira',type:'value',resultType:'record',expression:first()},{id:'mass',label:'Massa',type:'value',resultType:'number',expression:n('sum',{source:n('map',{source:n('property',{fieldId:'modules',value:n('local',{localId:'chosen'})}),value:n('read',{dataId:'mass'})})})}]}};
 const signature='0'.repeat(64),intent=prepareActionIntent(f.system,f.character,action),marker=prepareActivationMilestone(f.system,f.character,action,intent,signature);applyCharacterChanges(f.character,marker.patches);assert.equal(f.character.energy,6);const record=f.character.actionRecords[0];assert.equal(Object.hasOwn(record,'localContexts'),false);
 const resumed=resumeActionIntent(f.system,f.character,action,record,signature),plan=resolveActionIntent(f.system,f.character,action,resumed,{activation:record,signature,die:()=>assert.fail('Sem RNG')});assert.equal(plan.locals.mass,4);assert.equal(f.character.energy,6);assert.deepEqual(plan.patches,[]);
 f.character.items[0].modules[0].mass=5;assert.throws(()=>resumeActionIntent(f.system,f.character,action,record,signature),/mudou|mudaram/);
});
