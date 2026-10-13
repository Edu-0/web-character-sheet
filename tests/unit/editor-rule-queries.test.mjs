import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRule,createRuleContext,compileRules,RULE_OPERATIONS,ruleCalculationKey} from '../../js/engine/rule-registry.js';
import {computedValue} from '../../js/engine/computed-values.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {expandComponents} from '../../js/engine/layout-components.js';
import {knownReferences} from '../../js/editor/references.js';
import {rollValue} from '../../js/engine/roll-values.js';
import {checkSources,prepareCheck} from '../../js/engine/checks.js';
import {validateRollValueSource} from '../../js/validation/entry-rolls.js';
import {validateChecks} from '../../js/validation/checks.js';
import {experimentRows} from '../../js/editor/experiment-report.js';
let serial=0;const n=(op,parts={})=>({id:'part-'+ ++serial,op,version:1,...parts}),lit=value=>n('literal',{value}),read=dataId=>n('read',{dataId}),rule=(expression,resultType='number',id='main',extra={})=>({id,label:id,revision:1,kind:'calculation',resultType,expression,...extra});
const d=(id,type,extra={})=>({id,label:id,type,binding:id,required:false,nullable:false,...extra});
function fixture(){
 const system={schemaVersion:3,dataDefinitions:[d('items','collection',{fields:[d('weight','number'),d('quantity','integer'),d('equipped','boolean'),d('name','string'),d('modules','collection',{fields:[d('mass','number')]})]}),d('choice','reference',{target:{scope:'system',catalogId:'routes'},multiple:false}),d('enabled','boolean'),d('optional','number',{nullable:true}),d('title','string')],catalogs:[{id:'routes',label:'Rotas',fields:[d('price','number'),d('route-name','string',{binding:'name'})],entries:[{id:'free',price:0,name:'Curta'},{id:'deep',price:3,name:'Profunda'}]}],rules:[]};
 const character={items:[{id:'a',weight:2,quantity:3,equipped:true,name:'Mapa',modules:[{id:'ma',mass:4}]},{id:'b',weight:9,quantity:1,equipped:false,name:'Bússola',modules:[{id:'mb',mass:7}]}],choice:'free',enabled:false,optional:null,title:''};return {system,character};
}
const run=(expression,type='number',setup=()=>{})=>{const f=fixture();f.system.rules=[rule(expression,type)];setup(f);return evaluateRule(f.system,f.character,'main');};
const weights=()=>n('map',{source:read('items'),value:read('weight')});

test('AV-03 receita declarada de modificador calcula 9/10/15 sem regra de RPG implícita',()=>{
 const expression=n('floor',{value:n('divide',{left:n('subtract',{left:read('optional'),right:lit(10)}),right:lit(2)})});
 for(const [score,expected]of [[9,-1],[10,0],[15,2]])assert.equal(run(expression,'number',f=>f.character.optional=score),expected);
});

test('AV-03 relatório lê entradas atuais por identidade e calcula sem alterar amostra/template',()=>{
 const f=fixture(),pkg=minimalPackage('report-queries');Object.assign(pkg.system,f.system);pkg.system.characterTemplate={items:[]};pkg.system.rules=[rule(n('sum',{source:weights()})),rule(read('weight'),'number','entry',{context:{dataId:'items'}})];
 const before=structuredClone({pkg,character:f.character}),rows=experimentRows(pkg,f.character);
 assert.deepEqual(rows.filter(r=>r.dataId==='weight').map(r=>[r.context.entries[0].entryId,r.initial,r.current]),[['a',undefined,2],['b',undefined,9]]);
 assert.equal(rows.find(r=>r.ruleId==='main').initial,0);assert.equal(rows.find(r=>r.ruleId==='main').current,11);
 assert.deepEqual(rows.filter(r=>r.ruleId==='entry').map(r=>r.current),[2,9]);assert.deepEqual({pkg,character:f.character},before);
});
test('AV-03 operações registradas têm execução comprovada, incluindo presença e textos',()=>{
 const stepSetup=f=>{f.system.dataDefinitions.push(d('scale','trait',{scale:[4,6,8],composite:false}));f.system.catalogs.push({id:'steps',label:'Passos',fields:[d('start','integer'),d('end','integer'),d('cost','number')],entries:[{id:'a',start:4,end:6,cost:1},{id:'b',start:6,end:8,cost:2}]});};
 const cases=[['stepCost',()=>n('stepCost',{dataId:'scale',catalogId:'steps',fromFieldId:'start',toFieldId:'end',costFieldId:'cost',from:lit(4),to:lit(8)}),3,'number',stepSetup],['literal',()=>lit(2),2],['read',()=>read('quantity'),3],['ifAbsent',()=>n('ifAbsent',{value:read('optional'),fallback:lit(8)}),8],['ifNull',()=>n('ifNull',{value:read('optional'),fallback:lit(5)}),5],['if',()=>n('if',{condition:lit(false),then:n('divide',{left:lit(1),right:lit(0)}),else:lit(7)}),7],['add',()=>n('add',{left:lit(2),right:lit(3)}),5],['subtract',()=>n('subtract',{left:lit(2),right:lit(3)}),-1],['multiply',()=>n('multiply',{left:lit(2),right:lit(3)}),6],['divide',()=>n('divide',{left:lit(3),right:lit(2)}),1.5],['floor',()=>n('floor',{value:lit(-0.5)}),-1],['abs',()=>n('abs',{value:lit(-3)}),3],['equal',()=>n('equal',{left:lit(false),right:lit(false)}),true,'boolean'],['less',()=>n('less',{left:lit(2),right:lit(3)}),true,'boolean'],['lessEqual',()=>n('lessEqual',{left:lit(3),right:lit(3)}),true,'boolean'],['greater',()=>n('greater',{left:lit(3),right:lit(2)}),true,'boolean'],['greaterEqual',()=>n('greaterEqual',{left:lit(2),right:lit(2)}),true,'boolean'],['and',()=>n('and',{left:lit(false),right:n('greater',{left:n('divide',{left:lit(1),right:lit(0)}),right:lit(0)})}),false,'boolean'],['or',()=>n('or',{left:lit(true),right:n('greater',{left:n('divide',{left:lit(1),right:lit(0)}),right:lit(0)})}),true,'boolean'],['not',()=>n('not',{value:lit(false)}),true,'boolean'],['exists',()=>n('exists',{value:read('optional')}),true,'boolean'],['isNull',()=>n('isNull',{value:read('optional')}),true,'boolean'],['isEmpty',()=>n('isEmpty',{value:read('title')}),true,'boolean'],['resolved',()=>n('resolved',{value:read('choice')}),true,'boolean'],['sum',()=>n('sum',{source:weights()}),11],['count',()=>n('count',{source:read('items')}),2],['min',()=>n('min',{source:weights()}),2],['max',()=>n('max',{source:weights()}),9],['any',()=>n('any',{source:read('items'),predicate:read('equipped')}),true,'boolean'],['all',()=>n('all',{source:read('items'),predicate:read('equipped')}),false,'boolean'],['text',()=>n('text',{value:lit(false)}),'Não','string'],['concat',()=>n('concat',{left:lit('Rota: '),right:lit('Profunda')}),'Rota: Profunda','string']];
 const covered=new Set(cases.map(([op])=>op));for(const [op,build,value,type='number',setup]of cases){const f=fixture();setup?.(f);const expression=build();if(op==='read'){f.system.rules=[rule(expression,type,'main',{context:{dataId:'items'}})];assert.equal(evaluateRule(f.system,f.character,'main',{dataContext:{entries:[{dataId:'items',entryId:'a'}]}}),value);continue;}if(op==='ifAbsent')delete f.character.optional;f.system.rules=[rule(expression,type)];assert.equal(evaluateRule(f.system,f.character,'main'),value,op);}
 assert.equal(run(n('sum',{source:n('map',{source:n('filter',{source:read('items'),predicate:read('equipped')}),value:n('multiply',{left:read('weight'),right:read('quantity')})})})),6);covered.add('filter');covered.add('map');
 assert.equal(run(n('property',{value:n('lookup',{source:n('catalog',{catalogId:'routes'}),key:read('choice')}),fieldId:'price'})),0);for(const op of ['property','lookup','catalog'])covered.add(op);
 assert.equal(run(n('property',{fieldId:'price',value:n('only',{source:n('filter',{source:n('catalog',{catalogId:'routes'}),predicate:n('equal',{left:n('property',{fieldId:'price',value:n('item')}),right:lit(0)})})})})),0);covered.add('only');
 assert.equal(run(n('sum',{source:n('map',{source:read('items'),value:n('property',{value:n('item'),fieldId:'weight'})})})),11);covered.add('item');
 assert.equal(run(n('count',{source:n('empty',{dataId:'items'})})),0);covered.add('empty');
 assert.equal(run(n('text',{value:n('option',{dataId:'category',optionId:'deep'})}),'string',f=>f.system.dataDefinitions.push(d('category','enum',{options:[{id:'deep',label:'Profunda'}]}))),'Profunda');covered.add('option');
 const traitData=d('trait-source','trait',{scale:[4,6,8,10],composite:true});assert.equal(run(n('exists',{value:n('trait',{dataId:traitData.id,dice:[8,6]})}),'boolean',f=>f.system.dataDefinitions.push(traitData)),true);covered.add('trait');assert.equal(run(n('sum',{source:n('traitDice',{value:n('trait',{dataId:traitData.id,dice:[8,6]})})}),'number',f=>f.system.dataDefinitions.push(traitData)),14);covered.add('traitDice');
 const shared=lit(3);assert.equal(run(n('add',{left:shared,right:n('node',{nodeId:shared.id})})),6);covered.add('node');
 const f=fixture();f.system.rules=[rule(lit(4),'number','base'),rule(n('rule',{ruleId:'base'}))];assert.equal(evaluateRule(f.system,f.character,'main'),4);covered.add('rule');assert.deepEqual([...covered].sort(),Object.keys(RULE_OPERATIONS).filter(id=>RULE_OPERATIONS[id].scope!=='action').sort());
});
test('AV-03 vazio tem semântica explícita; ausência/null exigem alternativas',()=>{
 for(const [op,expected,type]of [['sum',0,'number'],['count',0,'number'],['any',false,'boolean'],['all',true,'boolean']]){const expression=['any','all'].includes(op)?n(op,{source:read('items'),predicate:read('equipped')}):n(op,{source:op==='count'?read('items'):weights()});assert.equal(run(expression,type,f=>f.character.items=[]),expected);}
 for(const op of ['min','max']){const value=n(op,{source:weights()});assert.throws(()=>run(value,'number',f=>f.character.items=[]),/ausente/);assert.equal(run(n('ifAbsent',{value,fallback:lit(-1)}),'number',f=>f.character.items=[]),-1);}
 assert.throws(()=>run(n('ifAbsent',{value:read('optional'),fallback:lit(0)})),/nulo/);assert.equal(run(n('exists',{value:read('enabled')}),'boolean'),true);assert.equal(run(n('exists',{value:read('optional')}),'boolean',f=>delete f.character.optional),false);assert.equal(run(n('equal',{left:read('optional'),right:lit(null)}),'boolean'),true);assert.equal(run(n('isEmpty',{value:read('optional')}),'boolean'),false);
 assert.equal(run(n('resolved',{value:read('choice')}),'boolean',f=>f.character.choice='missing'),false);
});
test('AV-03 tipos não são coerções; ramos preguiçosos ainda são admitidos integralmente',()=>{
 for(const expression of [n('add',{left:lit('2'),right:lit(3)}),n('if',{condition:lit(1),then:lit(2),else:lit(0)}),n('equal',{left:lit(0),right:lit(false)}),n('sum',{source:read('items')})])assert.throws(()=>run(expression),/exige|tipos|tipo|comparação/);
 assert.throws(()=>run(n('divide',{left:lit(1),right:lit(0)})),/zero/);assert.throws(()=>run(n('multiply',{left:lit(1e308),right:lit(1e308)})),/finito/);
 const bad=n('if',{condition:lit(false),then:n('read',{dataId:'missing'}),else:lit(3)});assert.throws(()=>run(bad),/inexistente/);assert.throws(()=>run(n('if',{condition:lit(false),then:n('not-allowed'),else:lit(3)})),/indisponível/);
 assert.throws(()=>run(n('sum',{source:weights()}),'number',f=>f.character.items[0].weight='2'),/incompatível/);
});
test('AV-03 IDs e dependências diagnosticam ciclos mesmo sem executar o ramo',()=>{
 const f=fixture();f.system.rules=[rule(n('rule',{ruleId:'other'})),rule(n('rule',{ruleId:'main'}),'number','other')];assert.throws(()=>compileRules(f.system),/cíclica/);
 const self=n('node',{nodeId:'self'});self.id='self';assert.throws(()=>run(self),/cíclica/);
 const branch=n('add',{left:lit(2),right:lit(3)});branch.right.id=branch.left.id;assert.throws(()=>run(branch),/duplicada/);
 const isolated=n('map',{source:read('items'),value:read('weight')}),outside=n('node',{nodeId:isolated.value.id});assert.throws(()=>run(n('add',{left:n('sum',{source:isolated}),right:outside})),/outro contexto/);
 const unknown=n('add',{left:lit(2),right:lit(3),execute:'alert(1)'});assert.throws(()=>run(unknown),/parâmetro/);
 f.system.rules=Array.from({length:80},(_,i)=>rule(i===79?lit(1):n('add',{left:lit(1),right:n('rule',{ruleId:'rule-'+(i+1)})}),'number','rule-'+i));assert.throws(()=>compileRules(f.system),/profundidade/);
});
test('AV-03 escopos aninhados e reuso lexical não capturam o índice de outra entrada',()=>{
 const expression=n('sum',{source:n('map',{source:read('items'),value:n('sum',{source:n('map',{source:read('modules'),value:read('mass')})})})});assert.equal(run(expression),11);assert.equal(run(expression,'number',f=>f.character.items.reverse()),11);
 const outer=read('weight'),nested=n('sum',{source:n('map',{source:read('items'),value:n('node',{nodeId:outer.id})})});assert.equal(run(n('sum',{source:n('map',{source:read('items'),value:n('add',{left:outer,right:nested})})})),33);
 const inner=n('sum',{source:n('map',{source:read('items'),value:read('weight')})});assert.equal(run(n('sum',{source:n('map',{source:read('items'),value:inner})})),22);
 assert.throws(()=>run(read('weight')),/exige entrada/);
 const reference=read('selected-module');const resolved=n('all',{source:read('items'),predicate:n('and',{left:n('resolved',{value:reference}),right:n('all',{source:read('items'),predicate:n('resolved',{value:n('node',{nodeId:reference.id})})})})});
 assert.equal(run(resolved,'boolean',f=>{f.system.dataDefinitions[0].fields.push(d('selected-module','reference',{target:{scope:'character',dataId:'modules'},multiple:false}));f.character.items[0]['selected-module']='ma';f.character.items[1]['selected-module']='mb';}),true);
});
test('AV-03 índices e valores são descartados na revisão; chamadas mutáveis comuns não usam cache',()=>{
 const f=fixture();f.system.rules=[rule(n('property',{value:n('lookup',{source:n('catalog',{catalogId:'routes'}),key:read('choice')}),fieldId:'price'}))];const context=createRuleContext(f.system,f.character,{trace:true});assert.equal(context.evaluate('main'),0);f.system.catalogs[0].entries.splice(0,1,{id:'free',price:7,name:'Nova'});context.invalidate();assert.equal(context.evaluate('main'),7);assert.ok(context.trace.some(row=>row.value==='7'));assert.ok(context.readings.has(JSON.stringify(['choice',{entries:[]}])));
 f.character.choice='deep';assert.equal(evaluateRule(f.system,f.character,'main'),3);f.character.choice='free';assert.equal(evaluateRule(f.system,f.character,'main'),7);assert.throws(()=>evaluateRule(f.system,structuredClone(f.character),'main',{ruleEvaluation:context}),/outra revisão/);
 const clone=context.evaluate('main');assert.equal(clone,7);
});
test('AV-03 lookup exige uma identidade válida e uma correspondência, incluindo preço zero',()=>{
 const expression=n('property',{value:n('lookup',{source:n('catalog',{catalogId:'routes'}),key:read('choice')}),fieldId:'price'});assert.equal(run(expression),0);assert.throws(()=>run(expression,'number',f=>f.character.choice='gone'),/inexistente/);assert.throws(()=>run(expression,'number',f=>f.system.catalogs[0].entries.push({id:'free',price:9})),/duplicada/);
 assert.throws(()=>run(n('property',{value:n('lookup',{source:read('items'),key:read('choice')}),fieldId:'weight'})),/destino|Destino/);
});
test('AV-03 contexto de cálculo por entrada usa somente a cadeia declarada e ajustes separados',()=>{
 const f=fixture();f.system.rules=[rule(read('weight'),'number','main',{context:{dataId:'items'}})];const a={entries:[{dataId:'items',entryId:'a'}]},b={entries:[{dataId:'items',entryId:'b'}]};assert.equal(evaluateRule(f.system,f.character,'main',{dataContext:a}),2);assert.equal(evaluateRule(f.system,f.character,'main',{dataContext:b}),9);assert.throws(()=>evaluateRule(f.system,f.character,'main'),/contexto/);
 const key=ruleCalculationKey(f.system,'main',a);assert.equal(ruleCalculationKey(f.system,'main',{entries:[...a.entries,{dataId:'modules',entryId:'ma'}]}),key);f.character.calculationOverrides={[key]:{mode:'fixed',value:20}};assert.equal(computedValue({...f,ruleId:'main',dataContext:a}),20);assert.equal(computedValue({...f,ruleId:'main',dataContext:b}),9);assert.equal(computedValue({...f,ruleId:'main',dataContext:a},true),2);
 const p=minimalPackage('context');Object.assign(p.system,structuredClone(f.system));const container=p.layouts[0].tabs[0].sections[0].containers[0];container.components=[{type:'computed',ruleId:'main',label:'Peso'}];assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid');container.components=[{type:'group',repeat:{scope:'character',dataId:'items'},components:[{type:'computed',ruleId:'main',label:'Peso'}]}];assert.equal(prepareDocument(p,{kind:'package'}).status,'ready');assert.deepEqual(expandComponents(container,p.system,f.character).map(c=>c.dataContext),[a,b]);
});
test('AV-03 automático e efetivo são explícitos; texto/booleano ignoram ajustes numéricos',()=>{
 const f=fixture();f.system.rules=[rule(lit(2),'number','base'),rule(n('rule',{ruleId:'base',mode:'automatic'})),rule(n('rule',{ruleId:'base',mode:'effective'}),'number','effective'),rule(lit('Texto'),'string','text'),rule(lit(false),'boolean','flag')];f.character.calculationOverrides={'computed.base':{mode:'fixed',value:10},'computed.text':{mode:'fixed',value:99},'computed.flag':{mode:'fixed',value:99}};assert.equal(evaluateRule(f.system,f.character,'main'),2);assert.equal(evaluateRule(f.system,f.character,'effective'),10);assert.equal(computedValue({...f,ruleId:'text'}),'Texto');assert.equal(computedValue({...f,ruleId:'flag'}),false);
 const refs=knownReferences({system:f.system,layouts:[]});assert.ok(refs.some(r=>r.kind==='ruleId'&&r.value==='base'));
 f.system.rules[0].expression=read('optional');delete f.character.optional;assert.equal(evaluateRule(f.system,f.character,'effective'),10);assert.throws(()=>evaluateRule(f.system,f.character,'main'),/ausente/);
});
test('AV-03 orçamento agregado interrompe produto cartesiano e mantém dados intactos',()=>{
 const f=fixture();f.character.items=Array.from({length:100},(_,i)=>({id:'item-'+i,weight:1}));const expression=n('sum',{source:n('map',{source:read('items'),value:n('sum',{source:n('map',{source:read('items'),value:read('weight')})})})});f.system.rules=[rule(expression)];const before=structuredClone(f);assert.throws(()=>evaluateRule(f.system,f.character,'main'),/Orçamento/);assert.deepEqual(f,before);
 const context=createRuleContext({...fixture().system,rules:[rule(lit(1))]},{});for(let i=0;i<10001;i++){context.invalidate();assert.equal(context.evaluate('main'),1);}const budget={remaining:0};assert.throws(()=>evaluateRule({...fixture().system,rules:[rule(lit(1))]}, {},'main',{budget}),/Orçamento/);
});

test('AV-03 fontes de rolagem consomem regras puras e dados atuais, sem cálculos de RPG ocultos',()=>{
 const f=fixture();f.system.dataDefinitions.push(d('pb','number'));f.character.pb=3;f.system.rules=[rule(n('add',{left:lit(2),right:n('if',{condition:read('enabled'),then:read('pb'),else:lit(0)})}))];const source={ruleId:'main'},issues=[];validateRollValueSource(source,'fonte',f.system,issues);assert.deepEqual(issues,[]);assert.equal(rollValue(source,f),2);f.character.enabled=true;assert.equal(rollValue(source,f),5);assert.equal(rollValue({dataId:'pb'},f),3);
 const config={algorithm:'fate',note:'Oposição informada pela mesa',sources:[{id:'bonus',label:'Bônus',ruleId:'main'}]};validateChecks({own:config},issues,f.system);assert.deepEqual(issues,[]);assert.equal(checkSources(config,f.character,f.system)[0].value,5);const prepared=prepareCheck({...f,config,sourceId:'bonus',checkId:'own'}),before=structuredClone(f.character);assert.equal(prepared.execute(()=>1).modifier,5);assert.deepEqual(f.character,before);
 validateRollValueSource({...source,fallback:0},'fonte',f.system,issues);assert.ok(issues.some(i=>i.message.includes('alternativa')));delete f.character.pb;assert.throws(()=>rollValue(source,f),/ausente/);
 const bad=[];validateChecks({own:{...config,sources:[{id:'bonus',label:'Bônus',ruleId:'missing'}]}},bad,f.system);assert.ok(bad.length);
});
