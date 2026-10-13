import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRuleContext} from '../../js/engine/rule-registry.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {recoveryRecipePlan} from '../../js/editor/rule-plans.js';
import {applyOperations} from '../../js/editor/operations.js';
import {itemFields} from '../../js/editor/data-picker.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {initializeData} from '../../js/engine/data-definitions.js';
import {recoveryPlan,applyRecovery,recoveryDie} from '../../js/engine/recovery.js';
import {undoSheetAction} from '../../js/engine/assistance.js';
const d=(id,type,extra={})=>({id,label:id,binding:id,type,required:false,nullable:false,...extra});
function fixture(){const pkg=minimalPackage('typed-recovery');pkg.system.dataDefinitions=[d('pv','integer',{initial:5}),d('pvMax','integer',{initial:12}),d('used','integer',{initial:0}),d('total','integer',{initial:5}),d('die','string',{initial:'d8'}),d('abilities','collection',{initial:[],fields:[d('abilityName','string'),d('current','integer',{minimum:0,maximum:10}),d('maximum','integer'),d('marked','boolean'),d('detail','record',{fields:[d('charge','integer')]})]})];const config={id:'rest',label:'Recuperar',healing:{field:'pv',maxField:'pvMax',usedField:'used',totalField:'total',dieField:'die',minimum:1,modifier:{value:2}},operations:[{type:'restoreCollection',field:'abilities',valueField:'current',maxField:'maximum',filterField:'marked',filterValues:[true]}]};pkg.system.recoveryActions=[config];return {pkg,config};}
const ready=pkg=>assert.equal(prepareDocument(pkg,{kind:'package'}).status,'ready',JSON.stringify(prepareDocument(pkg,{kind:'package'}).diagnostics));

test('AV-10 recuperação enumera campos declarados sem entradas, com registro interno e nomes relativos',()=>{
 const {pkg}=fixture();ready(pkg);const before=structuredClone(pkg);assert.deepEqual(itemFields(pkg,'abilities').map(({key,type})=>({key,type})),[{key:'id',type:'text'},{key:'abilityName',type:'text'},{key:'current',type:'number'},{key:'maximum',type:'number'},{key:'marked',type:'boolean'},{key:'detail.charge',type:'number'}]);assert.deepEqual(pkg,before);
 pkg.system.characterTemplate.legacy=[];pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'list',label:'Legado',field:'legacy',itemSchema:{count:{type:'number',label:'Quantidade'}}});assert.deepEqual(itemFields(pkg,'legacy').map(f=>f.key),['id','count']);ready(pkg);
});

test('AV-10 recuperação reutiliza candidato, filtro e histórico, conservando usos desmarcados e presença',()=>{
 const {pkg,config}=fixture(),character=initializeData(pkg.system,structuredClone(pkg.system.characterTemplate));character.meta.id='actor';character.abilities=[{id:'a',abilityName:'Marcada',current:0,maximum:3,marked:true},{id:'b',abilityName:'Manual',current:1,maximum:5,marked:false}];const before=structuredClone(character),context={system:pkg.system,character};const plan=recoveryPlan(context,config,[6]);assert.deepEqual(character,before);assert.deepEqual(plan.effects.map(e=>e.field),['pv','used','abilities']);const event=applyRecovery(context,config,[6],before);assert.equal(character.pv,11);assert.equal(character.used,1);assert.equal(character.abilities[0].current,3);assert.equal(character.abilities[1].current,1);assert.equal(undoSheetAction(character,event,{system:pkg.system}),true);assert.deepEqual(character,before);
 delete pkg.system.dataDefinitions[0].initial;ready(pkg);assert.equal(Object.hasOwn(pkg.system.characterTemplate,'pv'),false);const missing=initializeData(pkg.system,structuredClone(pkg.system.characterTemplate));assert.throws(()=>recoveryPlan({system:pkg.system,character:missing},config,[6]),/inteiro/);assert.equal(Object.hasOwn(missing,'pv'),false);
});

test('AV-10 recuperação tipada recusa destinos e filtros incompatíveis sem materializar template',()=>{
 for(const change of [f=>f.config.healing.field='die',f=>f.config.healing.dieField='pv',f=>f.config.operations[0].field='pv',f=>f.config.operations[0].valueField='abilityName',f=>f.config.operations[0].maxField='marked',f=>f.config.operations[0].filterValues=[1],f=>f.config.operations[0].filterField='absent',f=>f.config.operations=[{type:'set',field:'pv',value:1.5}],f=>f.config.operations=[{type:'restoreValue',field:'die',maxField:'pvMax'}],f=>f.config.operations=[{type:'restoreValue',field:'pv',maxField:'die'}],f=>f.config.operations=[{type:'setCollection',field:'abilities',valueField:'current',value:11}]]){
  const f=fixture(),before=structuredClone(f.pkg.system.characterTemplate);change(f);assert.equal(prepareDocument(f.pkg,{kind:'package'}).status,'invalid');assert.deepEqual(f.pkg.system.characterTemplate,before);
 }
});


test('AV-10 receitas de recuperação reutilizam painel compatível e evitam colisão de registro com dado tipado',()=>{
 const {pkg}=fixture(),destination=['layouts',0,'tabs',0,'sections',0,'containers',0,'components'];pkg.system.recoveryActions=[];pkg.system.dataDefinitions.push(d('recovery_log','integer',{binding:'curto_registro'}));const first=recoveryRecipePlan(pkg,{name:'Curto',destination,action:{operations:[{type:'restoreValue',field:'pv',maxField:'pvMax'}]}}),next=JSON.parse(applyOperations(JSON.stringify(pkg),first.commands));ready(next);assert.equal(next.layouts[0].tabs[0].sections[0].containers[0].components[0].historyField,'curto_registro_2');const second=recoveryRecipePlan(next,{name:'Longo',destination,action:{operations:[{type:'set',field:'used',value:0}]}});assert.equal(second.reusedPanel,true);const complete=JSON.parse(applyOperations(JSON.stringify(next),second.commands));ready(complete);assert.equal(complete.layouts[0].tabs[0].sections[0].containers[0].components.length,1);assert.equal(complete.system.recoveryActions.length,2);
 next.layouts[0].tabs[0].sections[0].containers[0].components[0].visibleWhen={ruleId:'unavailable'};assert.equal(recoveryRecipePlan(next,{name:'Outro',destination,action:{operations:[]}}).reusedPanel,undefined);
});


test('AV-10 cálculo de cura usa a revisão da prévia e relê o modificador no commit, mantendo guard de contexto',()=>{
 const {pkg,config}=fixture();pkg.system.dataDefinitions.push(d('vigor','integer',{initial:14}));let serial=0;const n=(op,args={})=>({id:'heal-'+ ++serial,version:1,op,...args});pkg.system.rules=[{id:'modifier',label:'Vigor',kind:'calculation',revision:1,resultType:'number',expression:n('floor',{value:n('divide',{left:n('subtract',{left:n('read',{dataId:'vigor'}),right:n('literal',{value:10})}),right:n('literal',{value:2})})})}];config.healing.modifier={ruleId:'modifier'};ready(pkg);const character=initializeData(pkg.system,structuredClone(pkg.system.characterTemplate)),baseline=structuredClone(character),context={system:pkg.system,character,ruleEvaluation:createRuleContext(pkg.system,character)};context.ruleEvaluation.evaluate('modifier');const cloned={...context,character:structuredClone(character)};cloned.character.die='d2';assert.ok([3,4].includes(recoveryDie(cloned,config,'')));character.vigor=16;const changed=structuredClone(character);assert.throws(()=>applyRecovery(context,config,[6],baseline),/ficha mudou/);assert.deepEqual(character,changed);character.vigor=14;applyRecovery(context,config,[6],baseline);assert.equal(character.pv,11);assert.equal(character.used,1);
});
