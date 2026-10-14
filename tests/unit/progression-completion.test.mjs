import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {compileProgression,prepareProgressionPhase} from '../../js/engine/progression-choices.js';
import {applyCharacterChanges} from '../../js/engine/character-history.js';
import {assertEventBasis} from '../../js/engine/rule-events.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {knownReferences} from '../../js/editor/references.js';
import {dataChoices} from '../../js/editor/data-picker.js';
import {conditionKind} from '../../js/editor/condition-builder.js';

const node=(op,args={})=>({id:crypto.randomUUID(),version:1,op,...args}),read=dataId=>node('read',{dataId});
function fixture(){
 const pkg=minimalPackage('creation-guard'),system=pkg.system,d=(id,type,extra={})=>({id,label:id,binding:id,type,required:false,nullable:false,...extra});
 system.dataDefinitions=[d('creation','integer'),d('evolution','integer'),d('cap','integer'),d('confirmed','boolean'),d('attribute','trait',{scale:[4,6,8,10,12],composite:false}),d('skills','collection',{fields:[d('grade','trait',{scale:[4,6,8,10,12],composite:false})]})];
 const within=value=>node('lessEqual',{left:node('max',{source:node('traitDice',{value})}),right:read('cap')});
 system.rules=[{id:'may-finish',label:'Criação dentro da qualidade',revision:1,kind:'predicate',resultType:'boolean',expression:node('and',{left:read('confirmed'),right:node('and',{left:within(read('attribute')),right:node('all',{source:read('skills'),predicate:within(node('property',{fieldId:'grade',value:node('item')}))})})})}];
 system.progressionChoices={version:1,revision:1,creationDataId:'creation',evolutionDataId:'evolution',completeWhen:{ruleId:'may-finish',message:'Confirme o orçamento e respeite o teto inicial.'},reopenCreation:true,revocation:'noRefund',options:[]};
 return {pkg,system,character:{schemaVersion:3,meta:{id:'hero',system:system.id},creation:14,evolution:5,cap:6,confirmed:false,attribute:[4],skills:[{id:'skill',grade:[8]}],extra:{value:false}}};
}
test('AV-10 conclusão condicionada recusa orçamento não confirmado e traços acima do teto, sem mutar',()=>{
 const {system,character}=fixture();
 for(const edit of [()=>{},()=>{character.confirmed=true;},()=>{character.skills[0].grade=[6];character.attribute=[8];}]){edit();const before=structuredClone(character);assert.throws(()=>prepareProgressionPhase(system,character,'complete'),/Confirme o orçamento/);assert.deepEqual(character,before);}
 character.attribute=[6];const before=structuredClone(character),plan=prepareProgressionPhase(system,character,'complete');assert.deepEqual(character,before);applyCharacterChanges(character,plan.patches);assert.equal(character.progressionLedger.phase,'play');assert.equal(character.progressionLedger.creationSnapshot.remaining,14);assert.equal(character.evolution,5);assert.deepEqual(character.extra,{value:false});
 const snapshot=structuredClone(character.progressionLedger.creationSnapshot);character.skills[0].grade=[12];assert.deepEqual(character.progressionLedger.creationSnapshot,snapshot);assert.equal(character.evolution,5);
});
test('AV-10 confirmação da criação conserva guardas comuns contra alteração da fonte e regra',()=>{
 for(const change of [({character})=>{character.cap=4;},({character})=>{character.confirmed=false;},({system})=>{system.rules[0].label='Nova revisão';}]){const f=fixture();f.character.confirmed=true;f.character.skills[0].grade=[6];const plan=prepareProgressionPhase(f.system,f.character,'complete');change(f);assert.throws(()=>assertEventBasis(f.character,plan,f.system),/mudou/);assert.equal(f.character.progressionLedger,undefined);}
});
test('AV-10 condição de conclusão exige predicado global válido e aparece nos vínculos do editor',()=>{
 const {pkg,system}=fixture();assert.equal(prepareDocument(pkg,{kind:'package'}).status,'ready');assert.ok(knownReferences(pkg).some(row=>row.pointer==='/system/progressionChoices/completeWhen/ruleId'));
 system.rules.push({id:'number-rule',label:'Número',revision:1,kind:'calculation',resultType:'number',expression:node('literal',{value:1})},{id:'entry-rule',label:'Condição por entrada',revision:1,kind:'predicate',resultType:'boolean',context:{dataId:'skills'},expression:node('literal',{value:true})});
 assert.deepEqual(dataChoices(pkg,['system','progressionChoices','completeWhen','ruleId'],'ruleId'),[['may-finish','Criação dentro da qualidade']]);assert.equal(conditionKind(['system','progressionChoices','completeWhen']),'completeWhen');
 for(const binding of [{ruleId:'number-rule'},{ruleId:'entry-rule'},{ruleId:'missing'},null,{ruleId:'may-finish',extra:true}]){system.progressionChoices.completeWhen=binding;assert.throws(()=>compileProgression(system));}
});
test('AV-10 condição adicional é opt-in e não altera a política dos pacotes existentes',()=>{
 const {system,character}=fixture();delete system.progressionChoices.completeWhen;const plan=prepareProgressionPhase(system,character,'complete');applyCharacterChanges(character,plan.patches);assert.equal(character.progressionLedger.phase,'play');assert.deepEqual(character.skills[0].grade,[8]);assert.equal(character.confirmed,false);
});
