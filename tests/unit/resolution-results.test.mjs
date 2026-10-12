import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {prepareActionIntent,resolveActionIntent,compileActionFlow} from '../../js/engine/action-plan.js';
import {resolutionResultDefinition,resolutionPortId} from '../../js/engine/resolution-results.js';
import {typedValueIssue,safeDataId} from '../../js/engine/data-types.js';

const ast=(op,parts={})=>({id:crypto.randomUUID(),op,version:1,...parts}),literal=value=>ast('literal',{value});
const property=(step,name,value)=>ast('property',{fieldId:resolutionPortId(step,name),value});
const groups=step=>property(step,'groups',ast('local',{localId:step}));
const totals=step=>ast('map',{source:groups(step),value:property(step,'groups_total',ast('item'))});
const value=(id,expression)=>({id,label:id,type:'value',resultType:'number',expression});
const action=steps=>({id:'action',label:'Resolução genérica',flow:{version:1,revision:1,profile:'preview',inputs:[],costs:[],steps}});
const character=system=>({schemaVersion:3,meta:{system:system.id}});

test('AV-10: totais por fonte composta produzem Ápice/Base/Peso e replay sem novo RNG',()=>{
 const system=minimalPackage('pool-ports').system;system.dataDefinitions=['first','second'].map(id=>({id,label:id,binding:id,type:'trait',required:false,nullable:false,scale:[4,6,8],composite:true}));
 const step={id:'pool',label:'Fontes',type:'resolve',groups:['first','second'].map(id=>({id,label:id,type:'dice',dice:[{resultType:'trait',expression:ast('read',{dataId:id})}]}))},flow=action([step,...['max','min','sum'].map(op=>value(op,ast(op,{source:totals(step.id)})))]),source={...character(system),first:[8,6],second:[4]},before=structuredClone(source),faces=[4,3,2];
 const plan=resolveActionIntent(system,source,flow,prepareActionIntent(system,source,flow),{die:()=>faces.shift()});assert.deepEqual(source,before);assert.equal(plan.locals.max,7);assert.equal(plan.locals.min,2);assert.equal(plan.locals.sum,9);assert.equal(typedValueIssue(resolutionResultDefinition(step),plan.locals.pool),null);assert.deepEqual(plan.locals.pool.groups[0].dice.map(d=>d.original),[4,3]);
 const replay=resolveActionIntent(system,source,flow,plan.intent,{die:()=>assert.fail('Não deve rolar novamente')});assert.deepEqual(replay.locals,plan.locals);
});

test('AV-10: candidatos percentis compartilham unidade e podem ser consultados por operações comuns',()=>{
 for(const [bonus,total]of [[1,50],[-1,100]]){
  const system=minimalPackage('percentile-ports').system,step={id:'check',label:'Percentual',type:'resolve',groups:[{id:'percentile',label:'Unidade comum',type:'sharedPercentile',bonus:literal(bonus)}]},first=ast('lookup',{source:groups(step.id),key:literal('percentile')}),candidates=property(step.id,'groups_candidates',first),values=ast('map',{source:candidates,value:property(step.id,'groups_candidates_value',ast('item'))}),flow=action([step,value('low',ast('min',{source:values})),value('high',ast('max',{source:structuredClone(values)}))]),source=character(system),faces=[1,1,6];
  const plan=resolveActionIntent(system,source,flow,prepareActionIntent(system,source,flow),{die:()=>faces.shift()});assert.equal(plan.locals.check.total,total);assert.equal(plan.locals.check.groups[0].units,0);assert.deepEqual(plan.locals.check.groups[0].candidates.map(v=>v.value),[100,50]);assert.equal(plan.locals.low,50);assert.equal(plan.locals.high,100);assert.equal(typedValueIssue(resolutionResultDefinition(step),plan.locals.check),null);
 }
});

test('AV-10: portas preservam original, rerrolagem, explosão e seleção sem escrever a base',()=>{
 const system=minimalPackage('dice-ports').system,step={id:'dice',label:'Dados',type:'resolve',groups:[{id:'kept',label:'Seleção',type:'dice',dice:[{resultType:'number',expression:literal(6),count:literal(2)}],select:{mode:'keep',order:'high',count:1},reroll:{when:{comparison:'equal',threshold:1},limit:1,mode:'replace',optional:false}},{id:'exploded',label:'Explosão',type:'dice',dice:[{resultType:'number',expression:literal(6)}],explode:{when:{comparison:'equal',threshold:6},limit:2}}]},flow=action([step]),source=character(system),faces=[1,5,3,6,6,2],plan=resolveActionIntent(system,source,flow,prepareActionIntent(system,source,flow),{die:()=>faces.shift()});
 const [kept,exploded]=plan.locals.dice.groups;assert.equal(kept.dice[0].original,1);assert.equal(kept.dice[0].value,5);assert.deepEqual(kept.dice[0].rerolls.map(v=>v.value),[5]);assert.equal(kept.dice[1].kept,false);assert.deepEqual(exploded.dice[0].explosions.map(v=>v.value),[6,2]);assert.equal(exploded.total,14);assert.equal(typedValueIssue(resolutionResultDefinition(step),plan.locals.dice),null);assert.deepEqual(plan.patches,[]);
});

test('AV-10: sem lançamento expõe coleção vazia; quantidade zero não lê fonte opcional ausente',()=>{
 const system=minimalPackage('zero-ports').system;system.dataDefinitions=[{id:'missing',binding:'missing',label:'Opcional',type:'number',required:false,nullable:false}];
 const skip={id:'skip',label:'Sem lançamento',type:'resolve',groups:[],success:{comparison:'greaterEqual',threshold:literal(1)},when:literal(false),otherwise:{total:literal(0),success:literal(false),outcome:literal('Não lançar')}},zero={id:'zero',label:'Zero dados',type:'resolve',groups:[{id:'empty',label:'Sem fonte',type:'dice',dice:[{resultType:'number',expression:ast('read',{dataId:'missing'}),count:literal(0)}]}]},flow=action([skip,zero]),source=character(system),plan=resolveActionIntent(system,source,flow,prepareActionIntent(system,source,flow),{die:()=>assert.fail('Não deve usar RNG')});
 assert.deepEqual(plan.locals.skip.groups,[]);assert.equal(plan.locals.zero.total,0);assert.equal(plan.locals.zero.rolled,false);assert.deepEqual(plan.locals.zero.groups,[]);assert.equal(plan.readings.some(r=>r.dataId==='missing'),false);for(const step of [skip,zero])assert.equal(typedValueIssue(resolutionResultDefinition(step),plan.locals[step.id]),null);
});

test('AV-10: IDs longos têm portas válidas e as identidades usuais antigas são conservadas',()=>{
 assert.equal(resolutionPortId('step','total'),'step_total');const long='step_'+ 'a'.repeat(95),definition=resolutionResultDefinition({id:long,label:'Longo'}),ids=[],walk=d=>{ids.push(d.id);for(const child of d.fields||[])walk(child);};walk(definition);assert.ok(ids.every(safeDataId));assert.equal(new Set(ids).size,ids.length);assert.deepEqual(definition,resolutionResultDefinition({id:long,label:'Longo'}));
 const system=minimalPackage('long-ports').system;assert.doesNotThrow(()=>compileActionFlow(system,action([{id:long,label:'Longo',type:'resolve',groups:[]}])));
});

test('AV-10: uma fonte omitida não acrescenta zero ao mínimo das fontes participantes',()=>{
 const system=minimalPackage('omitted-source').system;system.dataDefinitions=[{id:'missing',binding:'missing',label:'Opcional',type:'number',required:false,nullable:false}];const step={id:'roll',label:'Fontes',type:'resolve',groups:[{id:'absent',label:'Omitida',type:'dice',dice:[{resultType:'number',expression:ast('read',{dataId:'missing'}),count:literal(0)}]},{id:'present',label:'Participante',type:'dice',dice:[{resultType:'number',expression:literal(6)}]}]},flow=action([step,value('base',ast('min',{source:totals(step.id)}))]),source=character(system),plan=resolveActionIntent(system,source,flow,prepareActionIntent(system,source,flow),{die:()=>2});assert.equal(plan.locals.base,2);assert.equal(plan.locals.roll.groups.length,1);assert.equal(plan.locals.roll.groups[0].id,'present');
});

test('AV-10: porta sintética ambígua é diagnosticada antes de executar',()=>{
 const system=minimalPackage('port-collision').system,flow=action([{id:'foo',label:'Primeira',type:'resolve',groups:[]},{id:'port_3_foo_groups',label:'Segunda',type:'resolve',groups:[]}]);assert.throws(()=>prepareActionIntent(system,character(system),flow),/porta temporária ambígua/);
});
