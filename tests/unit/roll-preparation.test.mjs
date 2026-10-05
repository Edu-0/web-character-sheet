import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkSources,prepareCheck,collectionCheckSourceId} from '../../js/engine/checks.js';
import {computedValue} from '../../js/engine/computed-values.js';
import {prepareEntryRoll} from '../../js/engine/entry-roll-preparation.js';
import {parseDiceExpression} from '../../js/engine/dice-expression.js';
import {validateSystemPackage,validateCharacterForPackage} from '../../js/validation/schemas.js';
import {recordCheck,getHistory,clearHistory} from '../../js/dice.js';
const pkg=JSON.parse(readFileSync('data/examples/check-buttons.package.json','utf8'));
test('botões validam referências explícitas; variável/chave de check e campo compartilham valor',()=>{
  assert.deepEqual(validateSystemPackage(pkg),[]);
  const character=structuredClone(pkg.system.characterTemplate);character.calculationOverrides={'computed.shared':{mode:'adjust',value:2}};
  const component=pkg.layouts[0].tabs[0].sections[0].containers[0].components[2];
  assert.equal(computedValue({...component,character,system:pkg.system}),5);
  assert.equal(checkSources(pkg.system.checks.action,character,pkg.system)[1].value,5);
  character.calculationOverrides['computed.shared']={mode:'fixed',value:0};character.score=undefined;
  assert.equal(checkSources(pkg.system.checks.action,character,pkg.system)[1].value,0);
  const bad=structuredClone(pkg);bad.system.checks.action.sources[1].variables.base.field='other';assert.ok(validateSystemPackage(bad).length);
  const badId=structuredClone(pkg);badId.layouts[0].tabs[0].sections[0].containers[0].components[1].roll.sourceId='missing';assert.ok(validateSystemPackage(badId).length);
});
test('ID de entrada permanece após ordem/nome; falta de ID legado não bloqueia dados',()=>{
  const character=structuredClone(pkg.system.characterTemplate);character.meta.id='test';character.skills.unshift({id:'other',name:'Outro',rating:8});
  const config=pkg.system.checks.action;
  assert.equal(checkSources(config,character,pkg.system).find(s=>s.id===collectionCheckSourceId('skill','practice')).value,3);
  character.skills.reverse();character.skills.find(item=>item.id==='practice').name='Novo nome';
  assert.equal(prepareCheck({config,character,system:pkg.system,checkId:'action',sourceId:collectionCheckSourceId('skill','practice')}).snapshot.options.value,3);
  delete character.skills[0].id;
  assert.ok(validateCharacterForPackage(character,pkg).some(issue=>issue.code==='roll.identity'&&issue.severity==='warning'));
});
test('falha na resolução não debita; preparação pura e débito conferido novamente',()=>{
  const character={energy:3},item={id:'one',name:'Teste'},context={character,item,system:{}};
  const args={expression:parseDiceExpression('1d6'),resource:{field:'energy',cost:{value:1}},context,consume:true};
  assert.throws(()=>prepareEntryRoll(args,()=>{throw new Error('falha');}));assert.equal(character.energy,3);assert.equal(item.rollOptions,undefined);
  const prepared=prepareEntryRoll(args,()=>4);assert.equal(prepared.result.total,4);assert.equal(character.energy,3);assert.equal(prepared.snapshot.cost,1);
  character.energy=2;assert.throws(()=>prepared.payment.apply(),/recurso mudou/);assert.equal(character.energy,2);
});
test('histórico estruturado conserva desafios, limite e resultado anterior independente',()=>{
  clearHistory();const result={algorithm:'progress',rolls:[7,9],challenges:[7,9],total:8,modifier:0,formula:'progresso',outcome:'Sucesso fraco',detail:'teste',snapshot:{schemaVersion:1,effects:{value:2}}};
  recordCheck(result);result.challenges[0]=1;result.snapshot.effects.value=0;
  assert.deepEqual(getHistory()[0].resolution.challenges,[7,9]);assert.equal(getHistory()[0].snapshot.effects.value,2);
  for(let i=0;i<25;i++) recordCheck(result);assert.equal(getHistory().length,20);assert.equal(new Set(getHistory().map(entry=>entry.id)).size,20);clearHistory();
});
