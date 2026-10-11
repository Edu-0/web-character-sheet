import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {predicateStatus,predicateBindingIssue,componentPresentation} from '../../js/engine/predicates.js';
import {executeSheetAction} from '../../js/engine/assistance.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {expandComponents} from '../../js/engine/layout-components.js';
import {buildSearchIndex} from '../../js/engine/search.js';
import {componentsForPrint} from '../../js/engine/print-profile.js';
import {conditionKind,conditionValue} from '../../js/editor/condition-builder.js';
import {dataChoices} from '../../js/editor/data-picker.js';
import {createRuleContext} from '../../js/engine/rule-registry.js';
let serial=0;const n=(op,parts={})=>({id:'node-'+ ++serial,op,version:1,...parts}),read=dataId=>n('read',{dataId}),lit=value=>n('literal',{value}),rule=(id,expression,resultType='boolean',extra={})=>({id,label:id,revision:1,kind:'calculation',resultType,expression,...extra}),d=(id,type,extra={})=>({id,label:id,type,binding:id,required:false,nullable:false,...extra});
function fixture(){const pkg=minimalPackage('predicates');pkg.system.dataDefinitions=[d('a','boolean'),d('b','boolean'),d('c','boolean',{nullable:true}),d('value','number'),d('items','collection',{fields:[d('enabled','boolean')]})];pkg.system.characterTemplate={...pkg.system.characterTemplate,a:false,b:false,value:3,items:[]};pkg.system.rules=[rule('allowed',n('or',{left:n('and',{left:read('a'),right:read('b')}),right:n('exists',{value:read('c')})})),rule('number',lit(2),'number'),rule('entry',read('enabled'),'boolean',{context:{dataId:'items'}})];return pkg;}
const binding={ruleId:'allowed',message:'Ative A e B ou preencha C.'};
test('AV-04 tabela verdade completa distingue propriedade existente de false/null',()=>{
 const pkg=fixture();for(const a of [false,true])for(const b of [false,true])for(const c of [undefined,false,true,null]){const character={...pkg.system.characterTemplate,a,b};if(c!==undefined)character.c=c;const before=structuredClone(character),status=predicateStatus(pkg.system,character,binding);assert.equal(status.allowed,a&&b||c!==undefined);assert.equal(status.error,undefined);assert.deepEqual(character,before);}
});
test('AV-04 existir e resolver referência têm intenções diferentes em apresentação/permissão',()=>{
 const pkg=fixture();pkg.system.dataDefinitions[2]=d('c','reference',{nullable:true,target:{scope:'system',catalogId:'passes'},multiple:false});pkg.system.catalogs=[{id:'passes',label:'Passagens',fields:[],entries:[{id:'valid'}]}];pkg.system.rules.push(rule('resolved',n('resolved',{value:read('c')})));const component={visibleWhen:binding},action={id:'explore',allowWhen:{ruleId:'resolved'},operations:[{type:'add',field:'value',amount:1}]};
 const character={...pkg.system.characterTemplate,c:null};assert.equal(componentPresentation(component,pkg.system,character).visible.allowed,true);assert.throws(()=>executeSheetAction(character,action,pkg.system),/condição não atendida/);assert.equal(character.value,3);character.c='valid';executeSheetAction(character,action,pkg.system);assert.equal(character.value,4);character.c=false;assert.equal(predicateStatus(pkg.system,character,action.allowWhen).allowed,false);
 for(const allowWhen of [null,false,{}])assert.throws(()=>executeSheetAction(character,{...action,allowWhen},pkg.system));assert.equal(character.value,4);
});
test('AV-04 binding exige booleano/v3/contexto e diagnóstico fecha permissão',()=>{
 const pkg=fixture();for(const bad of [null,false,{}, {ruleId:'number'},{ruleId:'missing'},{ruleId:'allowed',execute:'code'}])assert.equal(predicateStatus(pkg.system,pkg.system.characterTemplate,bad).allowed,false);
 assert.match(predicateBindingIssue({...pkg.system,schemaVersion:2},binding),/v3/);assert.match(predicateBindingIssue(pkg.system,{ruleId:'entry'},{collections:[]}),/contexto/);assert.equal(predicateBindingIssue(pkg.system,{ruleId:'entry'},{collections:['items']}),null);
 const character={...pkg.system.characterTemplate,a:true,b:null};const status=predicateStatus(pkg.system,character,binding);assert.equal(status.allowed,false);assert.equal(status.error,true);assert.match(status.message,/null|incompatível/);
});
test('AV-04 apresentação e execução usam intenção própria e nenhum bloqueio apaga valores',()=>{
 const pkg=fixture(),character=structuredClone(pkg.system.characterTemplate),component={type:'dataField',dataId:'value',visibleWhen:binding},before=structuredClone(character);
 assert.equal(componentPresentation(component,pkg.system,character).visible.allowed,false);assert.equal(componentPresentation(component,pkg.system,character).editable.allowed,true);assert.deepEqual(character,before);
 component.editableWhen=binding;assert.equal(componentPresentation(component,pkg.system,character).editable.allowed,false);character.c=false;assert.equal(componentPresentation(component,pkg.system,character).visible.allowed,true);
 const action={id:'change',label:'Alterar',allowWhen:binding,operations:[{type:'add',field:'value',amount:1}]};const event=executeSheetAction(character,action,pkg.system);assert.equal(character.value,4);assert.equal(event.changes.length,1);
 delete character.c;assert.throws(()=>executeSheetAction(character,action,pkg.system),/Ative A/);assert.equal(character.value,4);
});
test('AV-04 executor reavalia atuais apesar de cache de apresentação anterior',()=>{
 const pkg=fixture(),character={...pkg.system.characterTemplate,a:true,b:true},cache=createRuleContext(pkg.system,character);assert.equal(predicateStatus(pkg.system,character,binding,{ruleEvaluation:cache}).allowed,true);character.a=false;const before=structuredClone(character);assert.throws(()=>executeSheetAction(character,{id:'stale',allowWhen:binding,operations:[{type:'set',field:'value',value:99}]},pkg.system),/Ative A/);assert.deepEqual(character,before);
});
test('AV-04 ação validada e permissão inválida são recusadas sem alteração parcial',()=>{
 const pkg=fixture();pkg.system.sheetActions=[{id:'action',label:'Ação',allowWhen:{ruleId:'entry'},operations:[]}];assert.equal(prepareDocument(pkg,{kind:'package'}).status,'invalid');pkg.system.sheetActions[0].allowWhen=binding;assert.equal(prepareDocument(pkg,{kind:'package'}).status,'ready');
 const character={...pkg.system.characterTemplate,a:true,b:true},before=structuredClone(character);assert.throws(()=>executeSheetAction(character,{id:'type',allowWhen:binding,operations:[{type:'set',field:'value',value:'invalid'}]},pkg.system),/incompatível/);assert.deepEqual(character,before);
});
test('AV-04 escopo estático é conferido mesmo no repeat vazio e preservado por entrada',()=>{
 const pkg=fixture(),container=pkg.layouts[0].tabs[0].sections[0].containers[0];container.components=[{type:'information',label:'Somente habilitados',visibleWhen:{ruleId:'entry'}}];assert.equal(prepareDocument(pkg,{kind:'package'}).status,'invalid');container.components=[{type:'group',repeat:{scope:'character',dataId:'items'},components:container.components}];assert.equal(prepareDocument(pkg,{kind:'package'}).status,'ready');const character={...pkg.system.characterTemplate,items:[{id:'yes',enabled:true},{id:'no',enabled:false}]},expanded=expandComponents(container,pkg.system,character);assert.deepEqual(expanded.map(c=>componentPresentation(c,pkg.system,character).visible.allowed),[true,false]);character.items.reverse();assert.deepEqual(expandComponents(container,pkg.system,character).map(c=>componentPresentation(c,pkg.system,character).visible.allowed),[false,true]);
});
test('AV-04 grupo/instância herdam condições e busca/impressão respeitam a visibilidade',()=>{
 const pkg=fixture(),container=pkg.layouts[0].tabs[0].sections[0].containers[0];container.components=[{type:'group',label:'Grupo',visibleWhen:binding,components:[{type:'dataField',label:'Valor oculto',dataId:'value'}]}];const character=structuredClone(pkg.system.characterTemplate),before=structuredClone(character);
 assert.equal(componentsForPrint(container,pkg.system,'full',character).length,0);assert.equal(buildSearchIndex(pkg.layouts[0],character,pkg.system).length,0);assert.deepEqual(character,before);character.c=null;assert.equal(componentsForPrint(container,pkg.system,'full',character).length,1);assert.ok(buildSearchIndex(pkg.layouts[0],character,pkg.system).some(r=>r.label==='Valor oculto'));
 pkg.system.componentDefinitions=[{id:'compound',label:'Composto',revision:1,parameters:[],components:[{type:'information',label:'Info'}]}];container.components=[{type:'componentInstance',definitionId:'compound',bindings:{},visibleWhen:{ruleId:'entry'}}];assert.equal(prepareDocument(pkg,{kind:'package'}).status,'invalid');
});
test('AV-04 condição visual liga ID compartilhado e filtra fontes incompatíveis',()=>{
 const pkg=fixture();for(const key of ['visibleWhen','editableWhen','allowWhen'])assert.equal(conditionKind(['component',key]),key);assert.deepEqual(conditionValue({predicate:true,ruleId:'allowed',message:'Mensagem'}),{ruleId:'allowed',message:'Mensagem'});assert.throws(()=>conditionValue({predicate:true}),/Escolha/);
 assert.deepEqual(dataChoices(pkg,['system','sheetActions',0,'allowWhen','ruleId'],'ruleId').map(([id])=>id),['allowed']);assert.deepEqual(dataChoices(pkg,['layouts',0,'visibleWhen','ruleId'],'ruleId').map(([id])=>id),['allowed','entry']);
});
test('AV-04 espécie predicate é explícita, booleana e usa o mesmo grafo puro',()=>{
 const pkg=fixture();pkg.system.rules[0].kind='predicate';assert.equal(prepareDocument(pkg,{kind:'package'}).status,'ready');assert.equal(predicateStatus(pkg.system,pkg.system.characterTemplate,binding).allowed,false);pkg.system.rules[1].kind='predicate';assert.equal(prepareDocument(pkg,{kind:'package'}).status,'invalid');
});
