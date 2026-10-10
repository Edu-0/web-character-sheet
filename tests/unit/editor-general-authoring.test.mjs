import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {minimalPackage as legacyPackage} from '../legacy-editor-package.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {createTypedDataPlan,createTypedRulePlan,bindDataPlan,ruleNode,stepRecipe} from '../../js/editor/typed-data-commands.js';
import {EditorSession} from '../../js/editor/session.js';
import {readData,writeData,initializeData} from '../../js/engine/data-definitions.js';
import {evaluateRule,RULE_OPERATIONS,RULE_LIMITS} from '../../js/engine/rule-registry.js';
import {computedValue,computedKey} from '../../js/engine/computed-values.js';
import {expandComponents} from '../../js/engine/layout-components.js';
import {insertionPlan} from '../../js/editor/composition-commands.js';
import {knownReferences} from '../../js/editor/references.js';
import {knownUsages} from '../../js/editor/form-commands.js';
import {installationPlan} from '../../js/repositories/package-installation.js';
import {buildSearchIndex} from '../../js/engine/search.js';
import {validateLibraryBackup} from '../../js/validation/backup.js';
import {version3Plan} from '../../js/editor/package-commands.js';
import {dataIndex,compatibleData,systemSourceChoices} from '../../js/editor/data-index.js';
import {dataChoices} from '../../js/editor/data-picker.js';

const path=['layouts',0,'tabs',0,'sections',0,'containers',0,'components'];
const components=p=>p.layouts[0].tabs[0].sections[0].containers[0].components;
const ready=p=>assert.equal(prepareDocument(p,{kind:'package'}).status,'ready',JSON.stringify(prepareDocument(p,{kind:'package'}).diagnostics));
function fixture(){const session=new EditorSession({text:JSON.stringify(minimalPackage('opaque-system'))});const plan=createTypedDataPlan(session.validation.value,{name:'Vínculos',type:'number'});session.operate(plan.commands);return {session,id:plan.definition.id};}
const literal=value=>({...ruleNode(),value});
const binary=(op,left,right)=>({...ruleNode(op),left,right});
function withRule(pkg,expression){const copy=structuredClone(pkg);copy.system.rules=[{id:'opaque-rule',label:'Bônus',revision:1,kind:'calculation',resultType:'number',expression}];return copy;}

test('AV-01 pacote realmente vazio, versões explícitas e v1/v2 preservados ao abrir',()=>{
 const p=minimalPackage('empty');ready(p);assert.deepEqual(Object.keys(p.system.characterTemplate),['schemaVersion','meta']);assert.deepEqual(components(p),[]);assert.deepEqual(p.system.rules,[]);assert.deepEqual(p.system.dataDefinitions,[]);assert.equal(p.system.formulas,undefined);
 for(const version of [1,2]){const old=legacyPackage('old');old.schemaVersion=old.system.schemaVersion=old.layouts[0].schemaVersion=version;const raw=JSON.stringify(old),session=new EditorSession({text:raw});assert.equal(session.validation.status,'ready');assert.equal(session.text,raw);assert.equal(computedValue({...components(old)[3],system:old.system,character:old.system.characterTemplate}),3);}
 for(const version of [1,2]){const old=legacyPackage('old-roots');old.schemaVersion=old.system.schemaVersion=old.layouts[0].schemaVersion=version;old.system.rules={score:2,legacyCatalog:[{name:'Existente'}]};old.system.dataDefinitions={oldCatalog:[{name:'Antigo'}]};components(old)[3].variables={score:{system:'rules.score'}};const raw=JSON.stringify(old),session=new EditorSession({text:raw});ready(old);assert.equal(session.text,raw);assert.equal(computedValue({...components(old)[3],system:old.system,character:old.system.characterTemplate}),3);assert.ok(dataIndex(old).some(row=>row.scope==='system'&&row.field==='rules.score'));assert.ok(systemSourceChoices(old).some(row=>row.path==='rules.legacyCatalog'));assert.deepEqual(dataChoices(old,[...path,1,'dataId'],'dataId'),[]);assert.deepEqual(dataChoices(old,[...path,3,'ruleId'],'ruleId'),[]);}
 const wrong=structuredClone(p);wrong.schemaVersion=2;assert.equal(prepareDocument(wrong,{kind:'package'}).status,'invalid');wrong.schemaVersion=4;assert.equal(prepareDocument(wrong,{kind:'package'}).status,'unsupported');
 const old=legacyPackage('old');components(old).length=0;assert.equal(prepareDocument(old,{kind:'package'}).status,'invalid');
});
test('AV-01 habilitar v3 é operação explícita/desfazível, sem converter fórmulas ou personagens',()=>{
 const legacy=legacyPackage('opt-in');legacy.extensions={null:null,off:false};const original=JSON.stringify(legacy),session=new EditorSession({text:original});
 const plan=version3Plan(legacy);assert.equal(session.text,original);session.operate(plan.commands);const next=session.validation.value;ready(next);assert.equal(next.schemaVersion,3);assert.equal(next.system.schemaVersion,3);assert.equal(next.layouts[0].schemaVersion,3);assert.deepEqual(next.system.characterTemplate,legacy.system.characterTemplate);assert.deepEqual(next.system.formulas,legacy.system.formulas);assert.deepEqual(components(next),components(legacy));assert.deepEqual(next.extensions,legacy.extensions);assert.equal(computedValue({...components(next)[3],system:next.system,character:next.system.characterTemplate}),3);session.replay('undo');assert.equal(session.text,original);
});
test('AV-01 tipos independentes: ausência/null/0/false/texto vazio e criação sem materializar ao ler',()=>{
 const {session,id}=fixture();const system=session.validation.value.system,character=structuredClone(system.characterTemplate);assert.deepEqual(readData(system,character,id),{present:false});const raw=JSON.stringify(character);initializeData(system,character);assert.equal(JSON.stringify(character),raw);
 writeData(system,character,id,{present:true,value:0});assert.deepEqual(readData(system,character,id),{present:true,value:0});writeData(system,character,id,{present:false});assert.deepEqual(readData(system,character,id),{present:false});assert.throws(()=>writeData(system,character,id,{present:true,value:null}));
 for(const [type,initial]of [['number',0],['integer',0],['boolean',false],['string',''],['number',null]]){const pkg=minimalPackage('sentinel'),plan=createTypedDataPlan(pkg,{name:'Auxiliar',type,hasInitial:true,initial,nullable:initial===null});const s=new EditorSession({text:JSON.stringify(pkg)});s.operate(plan.commands);ready(s.validation.value);assert.equal(Object.hasOwn(s.validation.value.system.characterTemplate,plan.definition.binding),false);const c=initializeData(s.validation.value.system,structuredClone(s.validation.value.system.characterTemplate));assert.deepEqual(readData(s.validation.value.system,c,plan.definition.id),{present:true,value:initial});const row=dataIndex(s.validation.value).find(r=>r.dataId===plan.definition.id);assert.equal(row.value,initial);assert.deepEqual(row.components,[]);}
});
test('AV-01 valida valores de personagem sem nenhum componente e não converte tipos',()=>{
 const {session,id}=fixture();const pkg=session.validation.value,binding=pkg.system.dataDefinitions[0].binding;
 for(const value of ['2',false,null,{},[]]){const c={...pkg.system.characterTemplate,meta:{system:pkg.system.id,id:'character'},[binding]:value};assert.equal(prepareDocument(c,{kind:'character',pkg}).status,'invalid');}
 for(const [type,initial]of [['integer',1.5],['number','2'],['boolean',0],['string',false]]){const s=new EditorSession({text:JSON.stringify(minimalPackage('invalid-initial'))});s.operate(createTypedDataPlan(s.validation.value,{name:'Auxiliar',type,hasInitial:true,initial}).commands);assert.equal(s.validation.status,'invalid');}
 const required=structuredClone(pkg);required.system.dataDefinitions[0].required=true;assert.equal(prepareDocument(required,{kind:'package'}).status,'invalid');required.system.dataDefinitions[0].initial=0;ready(required);const c={...required.system.characterTemplate,meta:{system:required.system.id,id:'c'}};assert.equal(prepareDocument(c,{kind:'character',pkg:required}).status,'invalid');assert.throws(()=>writeData(required.system,c,id,{present:false}));
});
test('AV-01 bindings seguros, sobreposição/identidade e opções desconhecidas bloqueadas',()=>{
 const {session}=fixture(),base=session.validation.value;
 for(const binding of ['__proto__.bad','a.constructor','a..b','meta.name','schemaVersion','activeEffects.any','a.{key}']){const p=structuredClone(base);p.system.dataDefinitions[0].binding=binding;assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid',binding);}
 for(const binding of ['vinculos','vinculos.child']){const p=structuredClone(base);p.system.dataDefinitions.push({...p.system.dataDefinitions[0],id:'another',binding});assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid');}
 const p=structuredClone(base);p.system.dataDefinitions[0].binding='branch.value';p.system.characterTemplate.branch=null;assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid');
 for(const key of ['min','max','script','collection']){const p=structuredClone(base);p.system.dataDefinitions[0][key]=0;assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid',key);}
 const duplicate=structuredClone(base);duplicate.system.dataDefinitions.push({...duplicate.system.dataDefinitions[0],binding:'other'});assert.equal(prepareDocument(duplicate,{kind:'package'}).status,'invalid');
});
test('AV-01 dois componentes, identidade estável, busca, undo/redo e roundtrip sem copiar valor',()=>{
 const {session,id}=fixture();for(const label of ['Primeiro','Segundo'])session.operate(insertionPlan(session.validation.value,{type:'number',name:label,destination:path,existingField:id}).commands);
 const p=session.validation.value;ready(p);assert.deepEqual(components(p).map(c=>c.dataId),[id,id]);assert.ok(components(p).every(c=>c.field===undefined && c.default===undefined));const expanded=expandComponents(p.layouts[0].tabs[0].sections[0].containers[0],p.system);assert.equal(expanded[0].field,expanded[1].field);
 const c=structuredClone(p.system.characterTemplate);assert.equal(buildSearchIndex(p.layouts[0],c,p.system)[0].value,'Ausente');writeData(p.system,c,id,{present:true,value:14});assert.deepEqual(buildSearchIndex(p.layouts[0],c,p.system).map(e=>e.value),['14','14']);
 const original=session.text;session.operate([{type:'setProperty',path:['system','dataDefinitions',0,'label'],value:'Nome diferente'}]);assert.equal(session.validation.value.system.dataDefinitions[0].id,id);session.replay('undo');assert.equal(session.text,original);session.replay('redo');ready(session.validation.value);
 const imported=prepareDocument(JSON.parse(JSON.stringify(session.validation.document)),{kind:'package',normalize:true});assert.equal(imported.status,'ready');assert.deepEqual(imported.document,session.validation.document);assert.deepEqual(readData(imported.document.system,c,id),{present:true,value:14});
 assert.equal(knownUsages(p,['system','dataDefinitions',0]).length,2);assert.equal(knownReferences(p).filter(r=>r.kind==='dataId').length,2);
 // Toolbox's create-data + create-view plan is one history entry, without a shadow template default.
 for(const [type,initial]of [['number',0],['boolean',false],['text',''],['textarea','']]){
  const s=new EditorSession({text:JSON.stringify(minimalPackage('atomic-field'))}),before=s.text;
  s.operate(insertionPlan(s.validation.value,{type,name:'Novo auxiliar',destination:path,hasInitial:true,initial}).commands);ready(s.validation.value);
  const d=s.validation.value.system.dataDefinitions[0];assert.equal(d.initial,initial);assert.equal(components(s.validation.value)[0].dataId,d.id);assert.equal(Object.hasOwn(s.validation.value.system.characterTemplate,d.binding),false);
  s.replay('undo');assert.equal(s.text,before);s.replay('redo');ready(s.validation.value);assert.equal(s.validation.value.system.dataDefinitions[0].id,d.id);
 }
});
test('AV-01 religação explícita remove somente field/default e preserva extensões',()=>{
 const {session,id}=fixture();session.operate([{type:'insertNode',path,index:0,value:{type:'number',field:'old',default:7,label:'Uso',extensions:{nil:null,field:'old'}}}]);const p=session.validation.value;session.operate(bindDataPlan(p,[...path,0],id).commands);ready(session.validation.value);assert.deepEqual(components(session.validation.value)[0],{type:'number',dataId:id,label:'Uso',extensions:{nil:null,field:'old'}});session.replay('undo');assert.deepEqual(session.validation.value,p);
 const incompatible=structuredClone(p);components(incompatible)[0].type='text';assert.throws(()=>bindDataPlan(incompatible,[...path,0],id));
 for(const key of ['field','default']){const p=structuredClone(session.validation.value);components(p)[0].dataId=id;assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid',key);}
});
test('AV-01 operações numéricas limitadas têm executor, tipos, divisão/overflow e budgets',()=>{
 const {session,id}=fixture();let p=session.validation.value;const read={...ruleNode('read'),dataId:id},c={...p.system.characterTemplate,vinculos:14};
 const cases=[['literal',literal(4),4],['read',read,14],['add',binary('add',read,literal(5)),19],['subtract',binary('subtract',read,literal(5)),9],['multiply',binary('multiply',read,literal(5)),70],['divide',binary('divide',read,literal(5)),2.8],['floor',{...ruleNode('floor'),value:binary('divide',read,literal(5))},2],['ifAbsent',{...ruleNode('ifAbsent'),value:read,fallback:literal(3)},14]];
 assert.deepEqual(cases.map(([op])=>op).sort(),Object.keys(RULE_OPERATIONS).sort());
 for(const [op,ast,expected]of cases){const pkg=withRule(p,ast);ready(pkg);assert.equal(evaluateRule(pkg.system,c,'opaque-rule'),expected,op);}
 for(const ast of [binary('divide',literal(1),literal(0)),binary('multiply',literal(1e308),literal(1e308))])assert.throws(()=>evaluateRule(withRule(p,ast).system,c,'opaque-rule'));
 let deep=literal(0);for(let i=0;i<RULE_LIMITS.depth+2;i++)deep={...ruleNode('floor'),value:deep};assert.equal(prepareDocument(withRule(p,deep),{kind:'package'}).status,'invalid');assert.throws(()=>evaluateRule(withRule(p,deep).system,c,'opaque-rule'));
 let broad=literal(1);for(let i=0;i<8;i++)broad=binary('add',structuredClone(broad),structuredClone(broad));assert.equal(prepareDocument(withRule(p,broad),{kind:'package'}).status,'invalid');assert.throws(()=>evaluateRule(withRule(p,broad).system,c,'opaque-rule'));
 for(const mutate of [n=>n.op='eval',n=>n.version=2,n=>n.script='alert(1)',n=>n.value='2']){const ast=literal(1);mutate(ast);assert.equal(prepareDocument(withRule(p,ast),{kind:'package'}).status,'invalid');}
});
test('AV-01 ausência tem fallback lazy explícito; null, zero e inválidos não viram fallback',()=>{
 const {session,id}=fixture(),p=session.validation.value,read={...ruleNode('read'),dataId:id};let pkg=withRule(p,{...ruleNode('ifAbsent'),value:read,fallback:binary('divide',literal(1),literal(0))});
 assert.equal(evaluateRule(pkg.system,{vinculos:0},'opaque-rule'),0);assert.throws(()=>evaluateRule(pkg.system,{},'opaque-rule'),/zero/);
 pkg=withRule(p,{...ruleNode('ifAbsent'),value:read,fallback:literal(5)});assert.equal(evaluateRule(pkg.system,{},'opaque-rule'),5);
 pkg.system.dataDefinitions[0].nullable=true;assert.throws(()=>evaluateRule(pkg.system,{vinculos:null},'opaque-rule'),/nulo/);assert.throws(()=>evaluateRule(pkg.system,{vinculos:'4'},'opaque-rule'),/incompatível/);
 const noFallback=withRule(p,read);assert.throws(()=>evaluateRule(noFallback.system,{},'opaque-rule'),/ausente/);
});
test('AV-01 receita produz as mesmas operações editáveis e não assume zero para ausência',()=>{
 const {session,id}=fixture(),pkg=session.validation.value,expression=stepRecipe({dataId:id,step:5});assert.equal(expression.op,'floor');assert.equal(expression.value.op,'divide');assert.equal(expression.value.left.op,'read');let p=withRule(pkg,expression);ready(p);assert.equal(evaluateRule(p.system,{vinculos:14},'opaque-rule'),2);assert.throws(()=>evaluateRule(p.system,{},'opaque-rule'),/ausente/);
 p=withRule(pkg,stepRecipe({dataId:id,step:5,absentFallback:0}));ready(p);assert.equal(evaluateRule(p.system,{},'opaque-rule'),0);for(const step of [0,-1,NaN,Infinity,'5'])assert.throws(()=>stepRecipe({dataId:id,step}));assert.throws(()=>stepRecipe({dataId:'',step:5}));
});
test('AV-01 cálculo sem componente, reordenação/binding alternativo e ajustes por ruleId',()=>{
 const {session,id}=fixture();const expression={...ruleNode('floor'),value:binary('divide',{...ruleNode('read'),dataId:id},literal(5))},plan=createTypedRulePlan(session.validation.value,{name:'Bônus',expression});session.operate(plan.commands);const p=session.validation.value;ready(p);
 for(const [value,result]of [[0,0],[4,0],[5,1],[14,2],[15,3],[-1,-1]])assert.equal(evaluateRule(p.system,{vinculos:value},plan.rule.id),result);
 const renamed=structuredClone(p);renamed.system.dataDefinitions[0].binding='custom.opaque';renamed.system.dataDefinitions[0].label='Risco';renamed.system.rules[0].label='Outro';const c={custom:{opaque:15},calculationOverrides:{['computed.'+plan.rule.id]:{mode:'adjust',value:2}}};ready(renamed);const context={ruleId:plan.rule.id,system:renamed.system,character:c};assert.equal(computedValue(context),5);assert.equal(computedValue(context,true),3);assert.equal(computedKey(context),'computed.'+plan.rule.id);c.calculationOverrides[computedKey(context)]={mode:'fixed',value:0};assert.equal(computedValue(context),0);
 const exported=JSON.parse(JSON.stringify(renamed));ready(exported);assert.equal(evaluateRule(exported.system,c,plan.rule.id),3);assert.ok(knownReferences(exported).some(r=>r.kind==='dataId'&&r.value===id));
 const before=session.text;session.operate(insertionPlan(session.validation.value,{type:'computed',name:'Regra nova',destination:path,ruleExpression:expression}).commands);ready(session.validation.value);
 const sharedId=components(session.validation.value)[0].ruleId;assert.equal(session.validation.value.system.rules.length,2);assert.equal(computedValue({...components(session.validation.value)[0],system:session.validation.value.system,character:{vinculos:14}}),2);
 session.replay('undo');assert.equal(session.text,before);session.replay('redo');
 session.operate(insertionPlan(session.validation.value,{type:'computed',name:'Outro uso',destination:path,ruleId:sharedId}).commands);ready(session.validation.value);assert.equal(session.validation.value.system.rules.length,2);assert.deepEqual(components(session.validation.value).map(c=>c.ruleId),[sharedId,sharedId]);
});
test('AV-01 referências, bindings incompatíveis e identidades de nós são diagnosticados',()=>{
 const {session,id}=fixture(),p=session.validation.value;
 for(const c of [{type:'text',dataId:id},{type:'number',dataId:'missing'},{type:'computed',ruleId:'missing'},{type:'number',dataId:id,default:0},{type:'number',dataId:id,field:'vinculos'}]){const next=structuredClone(p);components(next).push(c);assert.equal(prepareDocument(next,{kind:'package'}).status,'invalid');}
 const unsupported=structuredClone(p.layouts[0]);unsupported.tabs[0].sections[0].containers[0].components=[{type:'tagList',dataId:id}];assert.equal(prepareDocument(unsupported,{kind:'layout'}).status,'invalid');
 const choices=structuredClone(p);choices.system.dataDefinitions.push({id:'flag',label:'Autorizado',type:'boolean',binding:'flag',required:false,nullable:false});components(choices).push({type:'number',label:'Número',dataId:id});ready(choices);
 assert.ok(compatibleData(choices,'number').some(row=>row.dataId===id));for(const type of ['counter','die','select','image','tagList'])assert.ok(!compatibleData(choices,type).some(row=>row.typed),type);
 assert.deepEqual(dataChoices(choices,[...path,0,'dataId'],'dataId').map(([value])=>value),[id]);components(choices)[0].type='boolean';assert.deepEqual(dataChoices(choices,[...path,0,'dataId'],'dataId').map(([value])=>value),['flag']);
 choices.system.rules=withRule(p,{...ruleNode('read'),dataId:id}).system.rules;assert.deepEqual(dataChoices(choices,['system','rules',0,'expression','dataId'],'dataId').map(([value])=>value),[id]);
 const ast=binary('add',literal(1),literal(2));ast.right.id=ast.left.id;assert.equal(prepareDocument(withRule(p,ast),{kind:'package'}).status,'invalid');
 const badRead={...ruleNode('read'),dataId:'missing'};assert.equal(prepareDocument(withRule(p,badRead),{kind:'package'}).status,'invalid');
 const type=structuredClone(p);type.system.dataDefinitions[0].type='boolean';assert.equal(prepareDocument(withRule(type,{...ruleNode('read'),dataId:id}),{kind:'package'}).status,'invalid');
});
test('AV-01 instalação comum protege dados vinculados e backup aceita pacote v3 sem nova semântica no personagem',()=>{
 const {session,id}=fixture(),base=session.validation.document,character={...base.system.characterTemplate,meta:{system:base.system.id,id:'c'},vinculos:14,extra:{off:false,nil:null}};
 const candidate=structuredClone(base);candidate.system.dataDefinitions[0].label='Outro nome';const plan=installationPlan({candidate,base,currentPackage:base,characters:[character]});assert.equal(plan.linkedIds[0],'c');assert.equal(character.vinculos,14);assert.deepEqual(character.extra,{off:false,nil:null});
 for(const key of ['binding','type','required','nullable']){const next=structuredClone(base);next.system.dataDefinitions[0][key]=({binding:'other',type:'integer',required:true,nullable:true})[key];assert.throws(()=>installationPlan({candidate:next,base,currentPackage:base,characters:[character]}),/migração|obrigatório/);}
 const removed=structuredClone(base);removed.system.dataDefinitions=[];assert.throws(()=>installationPlan({candidate:removed,base,currentPackage:base,characters:[character]}),/migração/);
 assert.deepEqual(validateLibraryBackup({kind:'rpg-library-backup',schemaVersion:2,systems:[base],characters:[character],preferences:{}}),[]);
 const initial=structuredClone(base);initial.system.dataDefinitions[0].initial=5;installationPlan({candidate:initial,base,currentPackage:base,characters:[character]});assert.equal(character.vinculos,14);assert.deepEqual(readData(initial.system,{},id),{present:false});
});
