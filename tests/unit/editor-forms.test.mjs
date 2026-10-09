import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditorSession} from '../../js/editor/session.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {structuralNodes,structureCommand,editableDocument,reconcileSelection} from '../../js/editor/form-structure.js';
const fixture=()=>{const pkg=minimalPackage('forms');pkg.extra={zero:0,no:false,nil:null,empty:'',list:[]};pkg.layouts[0].tabs[0].sections[0].containers[0].components[0].extra={nil:null};return pkg;};
test('estrutura cria, move, duplica e remove pela sessão, com extras e undo exato',()=>{
  const pkg=fixture(),text=JSON.stringify(pkg,null,3),session=new EditorSession({text});
  const node=structuralNodes(pkg).find(n=>n.kind==='tab');
  const duplicate=structureCommand(pkg,node,'duplicate');session.operate(duplicate.commands);
  assert.equal(session.validation.value.layouts[0].tabs[1].id,'main-copia');assert.deepEqual(session.validation.value.extra,pkg.extra);
  const cloned=structuralNodes(session.validation.value).find(n=>n.pointer==='/layouts/0/tabs/1');
  session.operate(structureCommand(session.validation.value,cloned,'move',{destination:['layouts',0,'tabs'],to:0}).commands);
  assert.equal(session.validation.value.layouts[0].tabs[0].id,'main-copia');
  session.replay('undo');session.replay('undo');assert.equal(session.text,text);
  const container=structuralNodes(pkg).find(n=>n.kind==='container');session.operate(structureCommand(pkg,container,'add',{type:'counter'}).commands);
  assert.equal(session.validation.value.layouts[0].tabs[0].sections[0].containers[0].components.at(-1).type,'counter');
  const last=structuralNodes(session.validation.value).at(-1);session.operate(structureCommand(session.validation.value,last,'remove').commands);
  assert.deepEqual(session.validation.value,pkg);
});
test('destino incompatível, colisão de ID e texto não interpretável não perdem dados',()=>{
  const pkg=fixture(),node=structuralNodes(pkg).find(n=>n.kind==='tab');
  assert.throws(()=>structureCommand(pkg,node,'move',{destination:['layouts'],to:0}));
  pkg.layouts.push(structuredClone(pkg.layouts[0]));pkg.layouts[1].id='other';
  assert.throws(()=>structureCommand(pkg,node,'move',{destination:['layouts',1,'tabs'],to:0}));
  const session=new EditorSession({text:JSON.stringify(pkg)});session.replaceText('{ invalid');assert.throws(()=>editableDocument(session));assert.equal(session.text,'{ invalid');
});
test('seleção usa definição original, conserva identidade inequívoca e limpa ambiguidade',()=>{
  const before=fixture(),after=structuredClone(before),path=['layouts',0,'tabs',0];after.layouts[0].tabs.unshift({id:'other',label:'Outra',sections:[]});
  assert.deepEqual(reconcileSelection(before,after,path),['layouts',0,'tabs',1]);
  const componentPath=[...path,'sections',0,'containers',0,'components',0];after.layouts[0].tabs[1].sections[0].containers[0].components[0].label='Renomeado';
  assert.equal(reconcileSelection(before,after,componentPath),null);
});

import {nodeSchema,resolveSchema} from '../../js/editor/form-metadata.js';
import {setValueCommands,renameKeyCommands,referenceOptions} from '../../js/editor/form-commands.js';
test('campos tipados preservam ausência/null/zero/false/vazio e extras em vizinhos',()=>{
  const pkg=fixture(),session=new EditorSession({text:JSON.stringify(pkg)}),path=['system','characterTemplate'];
  session.operate(setValueCommands(pkg,[...path,'new'],null));session.operate(setValueCommands(session.validation.value,[...path,'score'],0));
  session.operate(setValueCommands(session.validation.value,[...path,'no'],false));session.operate(setValueCommands(session.validation.value,[...path,'empty'],''));session.operate(setValueCommands(session.validation.value,[...path,'list'],[]));
  assert.deepEqual(session.validation.value.extra,pkg.extra);assert.equal(session.validation.value.system.characterTemplate.new,null);
  session.operate(setValueCommands(session.validation.value,[...path,'new'],null,true));assert.ok(!Object.hasOwn(session.validation.value.system.characterTemplate,'new'));
  const before=session.text;assert.throws(()=>session.operate(renameKeyCommands(session.validation.value,['system','formulas','total'],'constructor')));assert.equal(session.text,before);
});
test('descritores cobrem itemSchema/opções/variáveis sem formular parâmetros inertes',()=>{
  const list=nodeSchema('component',{type:'list'});assert.ok(list.itemSchema.values.itemField);assert.equal(list.itemDetails.properties.fields.items.type,'string');
  const select=resolveSchema(list.itemSchema.values,{type:'select'});assert.ok(select.properties.options.items.properties.value);assert.ok(select.properties.optionsFrom);
  const number=nodeSchema('component',{type:'number'});assert.ok(!number.min);assert.ok(!number.max);
  const computed=nodeSchema('component',{type:'computed'});assert.ok(computed.variables.values.properties.traitMaxField);assert.ok(computed.variables.values.properties.rollField);
  assert.deepEqual(referenceOptions(fixture(),[],'formula'),['total']);
});

import {renameDefinitionPlan,identityPlan,removalImpact} from '../../js/editor/form-commands.js';
import {knownReferences} from '../../js/editor/references.js';
test('renomeação de fórmula preserva chave dos cálculos e não reescreve texto/extras',()=>{
  const pkg=fixture();pkg.system.checks={test:{algorithm:'fate',note:'Mesa decide',sources:[{id:'total',label:'Total',formula:'total'}]}};pkg.extra.formula='total';pkg.layouts[0].tabs[0].sections[0].containers[0].components[3].extensions={formula:'total',field:'score'};
  const session=new EditorSession({text:JSON.stringify(pkg)}),plan=renameDefinitionPlan(pkg,['system','formulas','total'],'result');session.operate(plan.commands);
  const next=session.validation.value,c=next.layouts[0].tabs[0].sections[0].containers[0].components[3];assert.equal(c.formula,'result');assert.equal(c.overrideKey,'total');assert.equal(next.system.checks.test.sources[0].formula,'result');assert.equal(next.system.checks.test.sources[0].overrideKey,'total');assert.equal(next.extra.formula,'total');assert.deepEqual(c.extensions,{formula:'total',field:'score'});assert.equal(knownReferences(next).some(ref=>ref.pointer.includes('/extensions/')),false);assert.equal(next.system.formulas.result,'score + 1');assert.equal(session.validation.status,'ready');
  session.replay('undo');assert.deepEqual(session.validation.value,pkg);
});
test('renomeação de teste e ID de fonte atualiza somente consumidores corretos',()=>{
  const pkg=fixture();pkg.schemaVersion=2;pkg.layouts[0].schemaVersion=2;pkg.system.checks={test:{algorithm:'fate',note:'Mesa decide',sources:[{id:'base',label:'Base',field:'score'}]},other:{algorithm:'fate',note:'Mesa decide',sources:[{id:'base',label:'Base',field:'score'}]}};
  const components=pkg.layouts[0].tabs[0].sections[0].containers[0].components;components[1].roll={check:'test',sourceId:'base'};components.push({type:'checkRoll',configFrom:'checks.test',label:'Teste'});
  const session=new EditorSession({text:JSON.stringify(pkg)});session.operate(renameDefinitionPlan(pkg,['system','checks','test'],'renamed').commands);let next=session.validation.value;assert.equal(next.layouts[0].tabs[0].sections[0].containers[0].components[1].roll.check,'renamed');assert.equal(next.layouts[0].tabs[0].sections[0].containers[0].components[4].configFrom,'checks.renamed');
  session.operate(identityPlan(next,['system','checks','renamed','sources',0,'id'],'newBase').commands);next=session.validation.value;assert.equal(next.system.checks.other.sources[0].id,'base');assert.equal(next.layouts[0].tabs[0].sections[0].containers[0].components[1].roll.sourceId,'newBase');assert.equal(session.validation.status,'ready',JSON.stringify(session.validation.diagnostics));
});
test('impacto, identidade de pacote e descritores das famílias lógicas',()=>{
  const pkg=fixture(),impact=removalImpact(pkg,['system','formulas','total']);assert.equal(impact.incoming.length,1);const session=new EditorSession({text:JSON.stringify(pkg)});session.operate(identityPlan(pkg,['system','id'],'forms-copy').commands);assert.equal(session.validation.value.system.characterTemplate.meta.system,'forms-copy');assert.equal(session.validation.value.layouts[0].system,'forms-copy');assert.equal(session.validation.value.extra.zero,0);
  const schema=nodeSchema('system');for(const family of ['checks','entryRolls','recoveryActions','sheetActions','effectDefinitions','pointBudget','repertoire','techniqueUse'])assert.ok(schema[family].properties || schema[family].values || schema[family].items,family);
  assert.ok(nodeSchema('component',{type:'poolBuilder'}).traitSources.items.properties.excludeWhen);assert.ok(nodeSchema('component',{type:'stateList'}).overflow.properties.onLimit);assert.ok(nodeSchema('package').schemaVersion);
});

import {numberFromText} from '../../js/editor/form-commands.js';
test('números de formulário usam parser sem perda e não convertem texto inválido',()=>{
  for(const raw of ['','abc','9007199254740993','0.1234567890123456789','-0','1e999'])assert.throws(()=>numberFromText(raw));
  assert.equal(numberFromText('0'),0);assert.equal(numberFromText('-1.5'),-1.5);assert.equal(numberFromText('1e3',{integer:true}),1000);assert.throws(()=>numberFromText('1.5',{integer:true}));
});

test('remoção informa módulos compartilhados e renomeação de dados usados é delimitada',()=>{
  const pkg=fixture();pkg.system.pointBudget={sources:[]};pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'pointBudget',configFrom:'pointBudget'});
  assert.equal(removalImpact(pkg,['system','pointBudget']).incoming.length,1);
  assert.throws(()=>renameDefinitionPlan(pkg,['system','characterTemplate','score'],'newScore'));
  assert.throws(()=>renameDefinitionPlan(pkg,['layouts',0,'tabs',0,'sections',0,'containers',0,'components',0,'itemSchema','name'],'title'));
});

test('raiz inválida permanece JSON; ramo explícito incompatível não é substituído por adicionar',()=>{
  const pkg=fixture();pkg.system=null;const text=JSON.stringify(pkg,null,2),session=new EditorSession({text});assert.throws(()=>editableDocument(session),/sistema precisa ser um objeto/);assert.equal(session.text,text);
  const next=fixture();next.layouts[0].tabs=null;const layout=structuralNodes(next).find(n=>n.kind==='layout');assert.throws(()=>structureCommand(next,layout,'add'),/existente incompatível/);assert.equal(next.layouts[0].tabs,null);
  delete next.layouts[0].tabs;const repaired=new EditorSession({text:JSON.stringify(next)});repaired.operate(structureCommand(next,layout,'add').commands);assert.equal(repaired.validation.value.layouts[0].tabs.length,1);assert.deepEqual(repaired.validation.value.extra,next.extra);
});
test('nó estrutural nulo pode ser inspecionado, duplicado e removido sem conversão silenciosa',()=>{
  const pkg=fixture();pkg.layouts[0].tabs[0].sections[0].containers[0].components.push(null);const text=JSON.stringify(pkg),session=new EditorSession({text}),node=structuralNodes(pkg).at(-1);assert.ok(nodeSchema('component',null).type.enum.includes('text'));session.operate(structureCommand(pkg,node,'duplicate').commands);assert.equal(session.validation.value.layouts[0].tabs[0].sections[0].containers[0].components.at(-1),null);session.replay('undo');assert.equal(session.text,text);session.operate(structureCommand(pkg,node,'remove').commands);assert.equal(session.validation.status,'ready');
});
