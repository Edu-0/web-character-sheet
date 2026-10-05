import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activateEffect, effectContribution, changeEffectStatus, confirmEffectEvent, removeEffect} from '../../js/engine/effects.js';
import {calculationValue} from '../../js/engine/calculation-overrides.js';
import {prepareCheck} from '../../js/engine/checks.js';
import {validateEffects, validateEffectRevisionChange} from '../../js/validation/effects.js';
import {applyRecovery} from '../../js/engine/recovery.js';
import {prepareRollCost} from '../../js/engine/roll-cost.js';
import {validateSystemPackage} from '../../js/validation/schemas.js';
const swade=JSON.parse(readFileSync('data/systems/swade.system.json','utf8'));
test('Coringa: traço/dano +2, falha crítica prevalece, sem alterar base, expiração confirmada',()=>{
  const character=structuredClone(swade.characterTemplate), base=structuredClone(character.attributes);
  activateEffect(character,swade,'joker','one');
  assert.throws(()=>activateEffect(character,swade,'joker','two'));
  const args={config:swade.checks.trait,character,system:swade,checkId:'trait',sourceId:'agility',options:{target:4,modifier:1}};
  const prepared=prepareCheck(args);assert.equal(prepared.snapshot.options.modifier,3);
  const result=prepared.execute(()=>1);assert.equal(result.outcome,'Falha crítica');
  assert.equal(result.snapshot.effects.contributions[0].revision,1);
  assert.equal(prepareCheck({...args,checkId:'damage',config:swade.checks.damage,sourceId:'damage',options:{}}).execute(()=>3).total,8);
  assert.deepEqual(character.attributes,base);
  confirmEffectEvent(character,'endScene');assert.equal(character.activeEffects[0].status,'active');
  confirmEffectEvent(character,'endRound');assert.equal(character.activeEffects[0].status,'expired');
  assert.equal(prepared.snapshot.effects.value,2); // Snapshot anterior não muda.
  removeEffect(character,'one');assert.equal(character.activeEffects.length,0);
});
test('precedência, grupo exclusivo, contextual e metadados inertes',()=>{
  const target={kind:'calculation',key:'computed.defense'};
  const definition={id:'a',revision:1,label:'A',stacking:'unique',applicability:'always',group:'stance',duration:{type:'manual'},operations:[{type:'add',target,value:2}]};
  const system={effectDefinitions:[definition,{...definition,id:'b'}]},character={schemaVersion:2,base:10};
  activateEffect(character,system,'a','a');character.activeEffects[0].extra={keep:false};
  assert.throws(()=>activateEffect(character,system,'b','b'));
  character.calculationOverrides={'computed.defense':{mode:'adjust',value:-1}};
  assert.equal(calculationValue(character,target.key,10,{system}),11);
  character.calculationOverrides[target.key]={mode:'fixed',value:0};
  assert.equal(calculationValue(character,target.key,10,{system}),0);
  changeEffectStatus(character,'a','inactive');assert.deepEqual(character.activeEffects[0].extra,{keep:false});
  activateEffect(character,system,'b','b');assert.equal(effectContribution(character,system,target).value,2);
  system.effectDefinitions[1].applicability='confirmEachRoll';
  assert.equal(effectContribution(character,system,target).value,0);
  assert.equal(effectContribution(character,system,target,{confirmed:['b']}).value,2);
});
test('contrato recusa operações/duração/unidade, revisões conflitantes e alvos sem cálculo',()=>{
  assert.deepEqual(validateEffects(swade.effectDefinitions,{system:swade,definitions:true}),[]);
  for(const change of [d=>d.operations[0].type='set',d=>d.operations[0].target.key='missing',d=>d.operations[0].target.unit='dice',d=>d.operations[0].value=0.5,d=>d.duration.event='timer',d=>d.stacking='sum']){
    const defs=structuredClone(swade.effectDefinitions);change(defs[0]);assert.ok(validateEffects(defs,{system:swade,definitions:true}).length);
  }
  const character=structuredClone(swade.characterTemplate);activateEffect(character,swade,'joker','one');character.activeEffects[0].definitionRevision=2;
  assert.ok(validateEffects(character.activeEffects,{system:swade}).some(issue=>issue.severity==='error'));
  changeEffectStatus(character,'one','inactive');assert.ok(validateEffects(character.activeEffects,{system:swade}).some(issue=>issue.severity==='warning'));
});
test('custos excluem efeitos; recuperação invalida prévia por máximos e modificadores',()=>{
  const system={formulas:{cost:'base'},effectDefinitions:[{id:'a',revision:1,label:'A',stacking:'unique',applicability:'always',duration:{type:'manual'},operations:[{type:'add',target:{kind:'calculation',key:'computed.cost'},value:2}]}]};
  const character={schemaVersion:2,base:1,hp:{current:1,max:10},used:0,total:2,die:'1d6',energy:4};activateEffect(character,system,'a','a');
  const source={formula:'cost',overrideKey:'computed.cost'},context={character,system};
  assert.equal(prepareRollCost({cost:source,field:'energy'},context).cost,1);
  const config={id:'heal',label:'Heal',healing:{field:'hp.current',maxField:'hp.max',usedField:'used',totalField:'total',dieField:'die',modifier:source}};
  const baseline=structuredClone(character);character.hp.max=5;
  assert.throws(()=>applyRecovery(context,config,[3],baseline),/ficha mudou/);assert.equal(character.hp.current,1);
  character.hp.max=10;changeEffectStatus(character,'a','expired');
  assert.throws(()=>applyRecovery(context,config,[3],baseline),/ficha mudou/);
});
test('revisão semântica cresce e evento não expira novas instâncias fora da prévia',()=>{
  const changed=structuredClone(swade);changed.effectDefinitions[0].operations[0].value=3;
  assert.equal(validateEffectRevisionChange(swade,changed).length,1);changed.effectDefinitions[0].revision=2;assert.deepEqual(validateEffectRevisionChange(swade,changed),[]);
  changed.effectDefinitions[0].label='Nome corrigido';changed.effectDefinitions[0].operations=structuredClone(swade.effectDefinitions[0].operations);changed.effectDefinitions[0].revision=1;assert.deepEqual(validateEffectRevisionChange(swade,changed),[]);
  const character=structuredClone(swade.characterTemplate);activateEffect(character,swade,'joker','old');changeEffectStatus(character,'old','inactive');activateEffect(character,swade,'joker','new');
  confirmEffectEvent(character,'endRound',['old']);assert.equal(character.activeEffects[0].status,'expired');assert.equal(character.activeEffects[1].status,'active');
});
test('efeito sobre chave pontilhada aceita somente cálculo conhecido sem abrir catálogo inseguro',()=>{
  const pkg=JSON.parse(readFileSync('data/examples/check-buttons.package.json','utf8'));pkg.system.schemaVersion=2;
  pkg.system.effectDefinitions=[{id:'demo',label:'Demonstração',revision:1,stacking:'unique',applicability:'always',duration:{type:'manual'},operations:[{type:'add',target:{kind:'calculation',key:'computed.shared'},value:2}]}];
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'effectList'});
  assert.deepEqual(validateSystemPackage(pkg),[]);
  pkg.system.effectDefinitions[0].operations[0].target.key='computed.missing';assert.ok(validateSystemPackage(pkg).length);
  pkg.system.effectDefinitions[0].operations[0].target.key='computed.constructor';assert.ok(validateSystemPackage(pkg).length);
});
