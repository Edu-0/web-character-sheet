import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareDocument} from '../../js/validation/documents.js';
import {planNormalization} from '../../js/migrations/index.js';
import {diagnosticsFor} from '../../js/validation/diagnostics.js';
import {validateActions} from '../../js/validation/actions.js';
const pkg=JSON.parse(readFileSync('data/examples/check-rolls.package.json','utf8'));
test('ponteiros de layouts aninhados apontam ao documento e entrada malformada não lança',()=>{
  const bad=structuredClone(pkg);bad.layouts[0].tabs[0].sections[0].containers[0].components[0].type='missing';
  const result=prepareDocument(bad,{kind:'package'});assert.equal(result.status,'invalid');
  assert.ok(result.diagnostics.some(issue=>issue.pointer==='/layouts/0/tabs/0/sections/0/containers/0/components/0'));
  for(const tabs of [null,{},[null]]) {const candidate=structuredClone(pkg);candidate.layouts[0].tabs=tabs;assert.equal(prepareDocument(candidate,{kind:'package'}).status,'invalid');}
});
test('backup usa fachada pura e versões dos documentos contidos sem perder extras',()=>{
  const data={schemaVersion:1,kind:'rpg-library-backup',systems:[pkg],characters:[],preferences:{},extra:{off:false,zero:0}};
  const result=prepareDocument(data,{kind:'backup'});assert.equal(result.status,'ready');assert.deepEqual(result.document.extra,data.extra);
  const bad=structuredClone(data);bad.systems[0].layouts[0].schemaVersion=99;
  const unsupported=prepareDocument(bad,{kind:'backup'});assert.equal(unsupported.status,'unsupported');assert.ok(unsupported.diagnostics.some(issue=>issue.pointer==='/systems/0/layouts/0/schemaVersion'));
  assert.equal(data.systems[0].layouts[0].schemaVersion,1);
});

test('contrato de ação confere requisitos, operações e recursos consumidos sem layout',()=>{
  const system={characterTemplate:{energy:{current:3,max:5}}};
  const action={id:'recover',operations:[{type:'restoreResource',field:'energy'}]};
  const valid=[];validateActions([action],system,valid);assert.deepEqual(valid,[]);
  for(const mutate of [a=>a.operations[0].type='script',a=>a.requirements=[{field:'energy.current',min:'2'}],a=>a.operations[0].field='constructor.x']) {
    const candidate=structuredClone(action),issues=[];mutate(candidate);validateActions([candidate],system,issues);assert.ok(issues.length);
  }
  const issues=[];validateActions([action],system,issues,'system.sheetActions',{energy:{current:'invalid',max:5}});assert.ok(issues.length);
});

test('preparação é pura, distingue versão futura e diagnostica referência inexistente',()=>{
  const original=structuredClone(pkg), before=JSON.stringify(original);
  assert.equal(prepareDocument(original,{kind:'package'}).status,'ready');
  assert.equal(JSON.stringify(original),before);
  original.schemaVersion=99;
  assert.equal(prepareDocument(original,{kind:'package'}).status,'unsupported');
  original.schemaVersion=1;
  original.layouts[0].tabs[0].sections[0].containers[0].repeat={source:'missing'};
  const result=prepareDocument(original,{kind:'package'});
  assert.equal(result.status,'invalid');
  assert.ok(result.diagnostics.some(issue=>issue.code==='reference.missing' && issue.pointer.endsWith('/repeat/source')));
});
test('catálogo vazio válido e colisões de cálculos são recusadas',()=>{
  const p=structuredClone(pkg), container=p.layouts[0].tabs[0].sections[0].containers[0];
  p.system.empty=[];container.repeat={source:'empty'};
  assert.equal(prepareDocument(p,{kind:'package'}).status,'ready');
  delete container.repeat;
  container.components.push({type:'computed',formula:'adjusted',overrideKey:'collision'}, {type:'computed',formula:'adjusted',overrideKey:'collision',variables:{a:{value:1}}});
  assert.ok(prepareDocument(p,{kind:'package'}).diagnostics.some(issue=>issue.code==='calculation.collision'));
});
test('normalização preserva extras, zero e falso, é idempotente e recusa aliases conflitantes',()=>{
  const original={schemaVersion:1,meta:{id:'a',system:'external'},extra:{keep:true},items:[{rollOptions:{attack:false,attackModifier:'0',upcast:'',extensions:{keep:42}}}]};
  const context={system:{},layouts:[{tabs:[{sections:[{containers:[{components:[{type:'list',field:'items',entryAction:'roll'}]}]}]}]}]};
  const plan=planNormalization(original,'character',{pkg:context});
  assert.equal(original.items[0].rollOptions.attack,false);
  assert.equal(plan.document.items[0].rollOptions.checkEnabled,false);
  assert.equal(plan.document.items[0].rollOptions.modifier,'0');
  assert.deepEqual(plan.document.items[0].rollOptions.extensions,{keep:42});
  assert.deepEqual(planNormalization(plan.document,'character',{pkg:context}).changes,[]);
  original.items[0].rollOptions.checkEnabled=true;
  assert.throws(()=>planNormalization(original,'character',{pkg:context}),/conflitantes/);
});
test('diagnóstico mantém chave literal de override e limita sem declarar sucesso',()=>{
  const c={calculationOverrides:{'computed.a':{value:'bad'}}};
  const issues=diagnosticsFor([{path:'character.calculationOverrides.computed.a.value',message:'erro'}],c,'character');
  assert.equal(issues[0].pointer,'/calculationOverrides/computed.a/value');
  const many=diagnosticsFor(Array.from({length:201},(_,i)=>({path:`character.x${i}`,message:'erro'})),c,'character');
  assert.equal(many.length,200);assert.equal(many.at(-1).severity,'error');
});
