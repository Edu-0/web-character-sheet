import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRollTranscript,validateResolution} from '../../js/engine/roll-transcript.js';
import {changesBetween,applyCharacterChanges,CharacterHistory} from '../../js/character-history.js';
import {executeSheetAction,undoSheetAction} from '../../js/engine/assistance.js';
import {evaluateActionExpression,compileActionExpression} from '../../js/engine/action-expression.js';
import {evaluateRule} from '../../js/engine/rule-registry.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
const when=(comparison,threshold)=>({comparison,threshold});
const config=(groups,extra={})=>({version:1,groups,...extra});
const dice=(sides,extra={})=>({id:'group',type:'dice',dice:sides,...extra});
const sequence=values=>()=>{assert.ok(values.length,'não consumir RNG além do previsto');return values.shift();};
const run=(definition,values,extra={})=>resolveRollTranscript(definition,{actionId:'test-action',die:sequence([...values]),...extra});

test('AV-05 keep/drop e sucessos usam identidades e desempate estáveis',()=>{
 const definition=config([dice([6,6,6,6],{select:{mode:'keep',order:'high',count:3},score:{mode:'successes',when:when('greaterEqual',5)}})],{success:when('greaterEqual',2)});
 const success=run(definition,[6,5,2,1]),failure=run(definition,[4,3,2,1]);assert.equal(success.total,2);assert.equal(success.success,true);assert.equal(failure.total,0);assert.equal(failure.success,false);assert.deepEqual(success.groups[0].dice.map(d=>d.kept),[true,true,true,false]);
 const tied=run(config([dice([6,6,6],{select:{mode:'keep',order:'high',count:1}})]),[5,5,5]);assert.deepEqual(tied.groups[0].dice.map(d=>d.kept),[true,false,false]);const dropped=run(config([dice([6,6,6],{select:{mode:'drop',order:'low',count:1}})]),[5,5,5]);assert.deepEqual(dropped.groups[0].dice.map(d=>d.kept),[false,true,true]);
});
test('AV-05 rerrolagem substitui ou soma explicitamente, replay não consome RNG',()=>{
 const definition=config([dice([8,6],{reroll:{when:when('greaterEqual',1),mode:'replace',limit:1,optional:true}})]),first=run(definition,[7,4]);assert.equal(first.total,11);
 const result=run(definition,[3],{transcript:first.transcript,choices:{group:[0]}});assert.equal(result.total,7);assert.equal(result.groups[0].dice[0].original,7);assert.deepEqual(result.groups[0].dice[0].rerolls,[3]);assert.equal(result.transcript.draws.length,3);assert.deepEqual(run(definition,[],{transcript:result.transcript}),result);
 assert.throws(()=>run(definition,[],{transcript:result.transcript,choices:{group:[1]}}),/não pode ser trocada/);
 const summed=run(config([dice([8],{reroll:{when:when('greater',5),mode:'sum',limit:1,optional:false}})]),[7,3]);assert.equal(summed.total,10);
 assert.throws(()=>run(config([dice([6],{reroll:{when:when('less',3),mode:'replace',limit:1,optional:true}})]),[5],{choices:{group:[0]}}),/não atende/);
});
test('AV-05 explosão soma 6→6→2 e excesso recusa resultado inteiro',()=>{
 const definition=config([dice([6],{explode:{when:when('equal',6),limit:2}})]),result=run(definition,[6,6,2]);assert.equal(result.total,14);assert.deepEqual(result.groups[0].dice[0].explosions,[6,2]);assert.throws(()=>run(definition,[6,6,6]),error=>{assert.match(error.message,/Teto de explosão/);assert.equal(error.transcript.draws.length,3);return true;});
 const global=config([dice([6,6],{explode:{when:when('equal',6),limit:99}})]);let draws=0;assert.throws(()=>resolveRollTranscript(global,{actionId:'limit',die:()=>++draws===51?2:6}),error=>{assert.match(error.message,/100 lançamentos/);assert.equal(error.transcript.draws.length,100);return true;});
});
test('AV-05 falha técnica preserva transcript parcial e retomada não rola faces conhecidas',()=>{
 const definition=config([dice([6,6])]);let partial;assert.throws(()=>resolveRollTranscript(definition,{actionId:'test-action',die:sequence([4])}),error=>{partial=error.transcript;return true;});assert.equal(partial.draws.length,1);const resumed=run(definition,[3],{transcript:partial});assert.equal(resumed.total,7);assert.equal(resumed.transcript.draws.length,2);
 assert.throws(()=>run({...definition,modifier:1},[],{transcript:resumed.transcript}),/outra ação/);assert.throws(()=>run(definition,[],{transcript:{...resumed.transcript,draws:[...resumed.transcript.draws,resumed.transcript.draws[0]]}}),/duplicada/);
});
test('AV-05 percentil usa unidade compartilhada e 00→100, saldo escolhe menor/maior',()=>{
 const positive=run(config([{id:'percent',type:'sharedPercentile',bonus:1}]),[1,1,6]),negative=run(config([{id:'percent',type:'sharedPercentile',bonus:-1}]),[1,1,6]);assert.deepEqual(positive.groups[0].candidates,[100,50]);assert.equal(positive.total,50);assert.equal(negative.total,100);
 for(const bonus of [-2,-1,0,1,2])assert.equal(run(config([{id:'percent',type:'sharedPercentile',bonus}]),Array(2+Math.abs(bonus)).fill(1)).total,100);
});
test('AV-05 grupos compostos, pontuação por tamanho e faixas permanecem inspecionáveis',()=>{
 const result=run(config([dice([8,6]),{...dice([6]),id:'special'}],{ranges:[{id:'hit',label:'Sucesso',min:9,max:20}]}),[4,3,2]);assert.deepEqual(result.groups.map(g=>g.total),[7,2]);assert.equal(result.total,9);assert.equal(result.rangeId,'hit');
 const potency=run(config([dice([6,4],{score:{mode:'sum',weight:'sides'}})]),[1,1]);assert.equal(potency.total,10);
 for(const bad of [config([dice([6])],{version:2}),config([dice([6]),dice([8])]),config([dice([0])]),config([dice([Infinity])]),config([dice(Array(100).fill(6)),{...dice([6]),id:'extra'}]),config([dice([6])],{ranges:[{id:'a',label:'A',min:0,max:5},{id:'b',label:'B',min:5,max:9}]}),config([{id:'p',type:'sharedPercentile',bonus:3}]),config([dice([6],{execute:'script'})])])assert.throws(()=>validateResolution(bad));
 assert.throws(()=>run(config([dice([6])]),[7]),/Resultado do dado/);
});
test('AV-05 patches comuns preservam ausência/null/falsy e histórico reaplica sem executar regras',()=>{
 const before={meta:{id:'char',system:'test'},nullValue:null,falseValue:false,emptyValue:''},after={...structuredClone(before),newParent:{value:0},nullValue:0},changes=changesBetween(before,after),character=structuredClone(before),history=new CharacterHistory();history.activate(character);
 applyCharacterChanges(character,changes);history.record(character,{label:'Ação com transcript'});assert.deepEqual(character,after);history.apply(character,'undo');assert.deepEqual(character,before);assert.equal(Object.hasOwn(character,'newParent'),false);history.apply(character,'redo');assert.deepEqual(character,after);
 character.newParent.value=1;assert.throws(()=>applyCharacterChanges(character,changes,{expected:'after',result:'before'}),/mudou fora/);assert.equal(character.nullValue,0);
 assert.throws(()=>applyCharacterChanges(character,[{path:['meta','id'],beforeExists:true,afterExists:true,before:'char',after:'other'}]),/Patch/);
 assert.throws(()=>applyCharacterChanges(character,[{path:['__proto__'],beforeExists:false,afterExists:true,after:{}}]),/Patch/);
 assert.throws(()=>applyCharacterChanges(character,[...changes,changes[0]]),/sobrepostos|mudou fora/);
});
test('AV-05 executor legado usa commit de presença comum e undo remove pais criados',()=>{
 const character={meta:{id:'char',system:'test'}},before=structuredClone(character),event=executeSheetAction(character,{id:'set',operations:[{type:'set',field:'aux.value',value:null}]},{});assert.equal(event.version,2);assert.equal(event.changes[0].beforeExists,false);assert.equal(event.changes[0].after,null);assert.equal(undoSheetAction(character,event),true);assert.deepEqual(character,before);
 const invalid={...structuredClone(before)};assert.throws(()=>executeSheetAction(invalid,{id:'partial',operations:[{type:'set',field:'aux.value',value:0},{type:'unknown',field:'other'}]},{}));assert.deepEqual(invalid,before);
 const overwritten=executeSheetAction(character,{id:'set',operations:[{type:'set',field:'value',value:false}]},{});character.value=0;assert.equal(undoSheetAction(character,overwritten),false);assert.equal(character.value,0);
});

test('AV-05 entradas/locais tipados existem somente na ação e respeitam ordem de produtores',()=>{
 const system=minimalPackage('action-scopes').system,definition={id:'input',label:'Dificuldade',type:'number',required:true,nullable:false},scope={inputs:[definition],locals:[{...definition,id:'previous'}]},expression={id:'sum',op:'add',version:1,left:{id:'left',op:'input',version:1,inputId:'input'},right:{id:'right',op:'local',version:1,localId:'previous'}},character=structuredClone(system.characterTemplate),before=structuredClone(character);
 assert.equal(evaluateActionExpression(system,character,expression,'number',scope,{actionInputs:{input:8},actionLocals:{previous:2}}),10);assert.deepEqual(character,before);
 assert.throws(()=>compileActionExpression(system,expression,'number',{inputs:[definition],locals:[]}),/ainda não produzido/);assert.throws(()=>evaluateActionExpression(system,character,expression,'number',scope,{actionInputs:{input:'8'},actionLocals:{previous:2}}),/incompatível/);
 system.rules=[{id:'continuous',label:'Contínuo',kind:'calculation',revision:1,resultType:'number',expression:expression.left}];assert.throws(()=>evaluateRule(system,character,'continuous'),/somente dentro de ação/);
 system.rules=[];assert.equal(evaluateActionExpression(system,character,{id:'null',op:'literal',version:1,value:null},'number',{expectedDefinition:{...definition,nullable:true}}),null);
});
