import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {prepareDocument} from '../../js/validation/documents.js';
import {dataDefinitions,initializeData,readData,writeData} from '../../js/engine/data-definitions.js';
import {evaluateRule} from '../../js/engine/rule-registry.js';
import {transformed} from '../helpers/variant-package.mjs';
import {prepareActionIntent,resolveActionIntent,prepareCompletionMilestone} from '../../js/engine/action-plan.js';
import {actionSignature} from '../../js/engine/action-records.js';
import {prepareProgressionPhase} from '../../js/engine/progression-choices.js';
import {prepareEventChain} from '../../js/engine/rule-events.js';
import {applyCharacterChanges} from '../../js/engine/character-history.js';
const original=JSON.parse(await readFile(new URL('../../data/examples/cartographers.package.json',import.meta.url),'utf8'));
for(const variant of [1,2])test('AV-10 D: variante '+variant+' de nomes, IDs, portas e bindings preserva o percurso público',async()=>{
 const {pkg,ids}=transformed(original,variant);const prepared=prepareDocument(pkg,{kind:'package'});assert.equal(prepared.status,'ready',JSON.stringify(prepared.diagnostics));const system=pkg.system;
 const old=(label,list=original.system.dataDefinitions)=>list.find(d=>d.label===label),data=d=>dataDefinitions(system).find(row=>row.definition.id===ids.get(d.id)).definition,rule=label=>ids.get(original.system.rules.find(r=>r.label===label).id);
 const character=initializeData(system,{...structuredClone(system.characterTemplate),meta:{id:'sample-hero',system:system.id}});applyCharacterChanges(character,prepareProgressionPhase(system,character,'complete').patches);
 const jobs=old('Ofícios'),equipment=old('Equipamentos'),modules=old('Módulos',equipment.fields),routes=original.system.catalogs.find(c=>c.label==='Rotas');
 writeData(system,character,data(jobs).id,{present:true,value:[{id:'job-one',[data(old('Nome',jobs.fields)).binding]:'Explorador',[data(old('Habilitado',jobs.fields)).binding]:true}]});
 const parts=[[2,true],[3,true],[9,false]].map(([weight,on],index)=>({id:'part-'+index,[data(old('Nome',modules.fields)).binding]:'Peça '+index,[data(old('Peso',modules.fields)).binding]:weight,[data(old('Equipado',modules.fields)).binding]:on}));
 writeData(system,character,data(equipment).id,{present:true,value:[{id:'bag',[data(old('Nome',equipment.fields)).binding]:'Bolsa',[data(modules).binding]:parts}]});
 writeData(system,character,data(old('Rota escolhida')).id,{present:true,value:ids.get(routes.entries[1].id)});
 assert.equal(evaluateRule(system,character,rule('Carga dos módulos equipados')),5);assert.equal(evaluateRule(system,character,rule('Custo auxiliar da rota')),3);assert.equal(evaluateRule(system,character,rule('Risco auxiliar da rota')),4);assert.equal(evaluateRule(system,character,rule('Expedição autorizada')),true);
 const action=system.sheetActions.find(a=>a.id===ids.get(original.system.sheetActions.find(a=>a.label==='Explorar a Bruma').id)),before=structuredClone(character),faces=[6,5,2,1],intent=prepareActionIntent(system,character,action,{id:'sample-action'}),plan=resolveActionIntent(system,character,action,intent,{die:sides=>{assert.equal(sides,6);const face=faces.shift();assert.ok(face);return face;}});assert.deepEqual(character,before);assert.equal(faces.length,0);
 const completed=prepareEventChain(system,character,prepareCompletionMilestone(system,character,action,plan,await actionSignature(system,action)));applyCharacterChanges(character,completed.patches);
 for(const [label,value]of [['Tinta',2],['Vínculos',1],['Rastros',6]])assert.equal(readData(system,character,data(old(label)).id).value,value);
 assert.equal(readData(system,character,data(old('Descobertas')).id).value.length,1);assert.equal(character.actionRecords.length,1);assert.equal(character.ruleEventState.proposals.length,1);

});
