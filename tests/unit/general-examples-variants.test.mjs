import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {prepareDocument} from '../../js/validation/documents.js';
import {dataDefinitions,initializeData,readData,writeData} from '../../js/engine/data-definitions.js';
import {evaluateRule} from '../../js/engine/rule-registry.js';
import {prepareActionIntent,resolveActionIntent,prepareCompletionMilestone} from '../../js/engine/action-plan.js';
import {actionSignature} from '../../js/engine/action-records.js';
import {applyCharacterChanges} from '../../js/engine/character-history.js';
import {transformed} from '../helpers/variant-package.mjs';
const samples=Object.fromEntries(await Promise.all(['adventurers','investigator'].map(async name=>[name,JSON.parse(await readFile(new URL('../../data/examples/'+name+'.package.json',import.meta.url),'utf8'))])));
function fixture(name,variant){
 const original=samples[name],{pkg,ids}=transformed(original,variant),system=pkg.system;
 const prepared=prepareDocument(pkg,{kind:'package'});assert.equal(prepared.status,'ready',JSON.stringify(prepared.diagnostics));
 const old=(label,list=original.system.dataDefinitions)=>list.find(d=>d.label===label),data=d=>dataDefinitions(system).find(row=>row.definition.id===ids.get(d.id)).definition,find=label=>data(old(label)),rule=label=>ids.get(original.system.rules.find(r=>r.label===label).id);
 const character=initializeData(system,{...structuredClone(system.characterTemplate),meta:{id:'variant-character',system:system.id}}),put=(definition,value)=>writeData(system,character,definition.id,{present:true,value});
 return {original,pkg,ids,system,character,old,data,find,rule,put};
}
for(const variant of [1,2])test('AV-10 A: variante '+variant+' conserva referências, cálculos e rolagem com outros nomes/IDs/bindings',async()=>{
 const m=fixture('adventurers',variant),{system,character,old,data,find,rule,put}=m,attrs=old('Atributos'),name=data(old('Nome',attrs.fields)),score=data(old('Valor',attrs.fields));
 put(data(attrs),[{id:'force',[name.binding]:'Origem da carga',[score.binding]:15},{id:'mind',[name.binding]:'Origem da magia',[score.binding]:16}]);for(const label of ['Fonte da capacidade','Fonte da iniciativa','Fonte da cura'])put(find(label),'force');put(find('Fonte da conjuração'),'mind');
 assert.equal(evaluateRule(system,character,rule('Proficiência')),3);assert.equal(evaluateRule(system,character,rule('Capacidade de carga')),112.5);assert.equal(evaluateRule(system,character,rule('Ataque de conjuração')),6);assert.equal(evaluateRule(system,character,rule('CD de conjuração')),14);
 const skills=old('Perícias'),training=data(old('Treino',skills.fields));for(const [label,expected]of [['Sem treino',2],['Proficiente',5],['Especialista',8]]){
 put(data(skills),[{id:'skill',[data(old('Nome',skills.fields)).binding]:'Perícia',[data(old('Atributo vinculado',skills.fields)).binding]:'force',[training.binding]:m.ids.get(old('Treino',skills.fields).options.find(o=>o.label===label).id),[data(old('Bônus manual',skills.fields)).binding]:0}]);assert.equal(evaluateRule(system,character,rule('Total de Perícias'),{dataContext:{entries:[{dataId:data(skills).id,entryId:'skill'}]}}),expected);
 }
 const attacks=old('Ataques');put(data(attacks),[{id:'attack',[data(old('Nome',attacks.fields)).binding]:'Ação fictícia',[data(old('Modificador',attacks.fields)).binding]:2,[data(old('Dados de dano',attacks.fields)).binding]:[6]}]);put(find('Ataque escolhido'),'attack');
 const action=system.sheetActions.find(a=>a.id===m.ids.get(m.original.system.sheetActions.find(a=>a.label==='Rolar ataque').id)),before=structuredClone(character),intent=prepareActionIntent(system,character,action,{id:'variant-attack'}),faces=[17],plan=resolveActionIntent(system,character,action,intent,{die:sides=>{assert.equal(sides,20);return faces.shift();}});assert.equal(faces.length,0);assert.deepEqual(character,before);applyCharacterChanges(character,prepareCompletionMilestone(system,character,action,plan,await actionSignature(system,action)).patches);assert.equal(readData(system,character,find('Último ataque').id).value,22);assert.equal(character.actionRecords.length,1);
});
for(const variant of [1,2])test('AV-10 C: variante '+variant+' preserva unidade compartilhada e recursos manuais',async()=>{
 const m=fixture('investigator',variant),{system,character,old,data,find,rule,put}=m,skills=old('Perícias');put(data(skills),[{id:'skill',[data(old('Nome',skills.fields)).binding]:'Consultar pista',[data(old('Percentual',skills.fields)).binding]:63,[data(old('Marca de evolução',skills.fields)).binding]:true}]);put(find('Perícia selecionada'),'skill');assert.equal(evaluateRule(system,character,rule('Difícil')),31);assert.equal(evaluateRule(system,character,rule('Extremo')),12);
 for(const [bonus,expected]of [[1,50],[-1,100]]){put(find('Saldo de bônus'),bonus);const before=structuredClone(character),action=system.sheetActions[0],intent=prepareActionIntent(system,character,action,{id:'variant-'+bonus}),faces=[1,1,6],plan=resolveActionIntent(system,character,action,intent,{die:sides=>{assert.equal(sides,10);return faces.shift();}});assert.equal(faces.length,0);assert.deepEqual(character,before);applyCharacterChanges(character,prepareCompletionMilestone(system,character,action,plan,await actionSignature(system,action)).patches);assert.equal(readData(system,character,find('Último percentil').id).value,expected);for(const label of ['Sanidade','Sorte','PV','PM'])assert.equal(readData(system,character,find(label).id).value,readData(system,before,find(label).id).value);assert.equal(readData(system,character,data(skills).id).value[0][data(old('Marca de evolução',skills.fields)).binding],true);}
 assert.equal(character.actionRecords.length,2);
});
