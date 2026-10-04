import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollCheck, checkSources } from '../../js/engine/checks.js';
const dice = (...values) => () => { assert.ok(values.length, 'rolagem inesperada'); return values.shift(); };
test('Fate: faces, extremos, empate e limiar de estilo', () => {
  assert.equal(rollCheck('fate', { value: 0 }, dice(1,1,1,1)).total, -4);
  assert.equal(rollCheck('fate', { value: 3, modifier: 2 }, dice(3,3,3,3)).total, 9);
  for (const [target, outcome] of [[1,'Falha'],[0,'Empate'],[-1,'Sucesso'],[-2,'Sucesso'],[-3,'Sucesso com estilo']]) assert.equal(rollCheck('fate', { value: 0, target }, dice(2,2,2,2)).outcome, outcome);
  assert.throws(() => rollCheck('fate', { value: NaN }));
  assert.throws(() => rollCheck('fate', { value: 1.5 }));
  assert.throws(() => rollCheck('fate', { value: 1, modifier: Infinity }));
});
test('fontes consultam dados atuais e conservam IDs sem executar nomes', () => {
  const config = { sources: [{ field: 'score', label: 'Valor' }, { collection: 'skills', valueField: 'rating', label: 'Perícia' }] };
  const character = { score: 0, skills: [{ id: 'a', name: '<script>', rating: 42 }] };
  const before = structuredClone(character);
  assert.equal(checkSources(config, character)[1].value, 42);
  assert.deepEqual(character, before);
  character.skills[0].rating = 65;
  assert.equal(checkSources(config, character)[1].value, 65);
});

test('percentil: 00 é 100, bônus escolhe o menor candidato e penalidade o maior', () => {
  assert.equal(rollCheck('percentile', {value:50}, dice(1,1)).total, 100);
  assert.equal(rollCheck('percentile', {value:50,modifier:1}, dice(1,1,2)).total, 10);
  assert.equal(rollCheck('percentile', {value:50,modifier:-1}, dice(1,1,2)).total, 100);
  assert.equal(rollCheck('percentile', {value:51}, dice(6,3)).outcome, 'Grau difícil');
  assert.equal(rollCheck('percentile', {value:51}, dice(1,2)).outcome, 'Grau extremo');
  assert.equal(rollCheck('percentile', {value:0}, dice(2,1)).outcome, 'Acima do percentual');
  assert.throws(() => rollCheck('percentile', {value:50,modifier:3}));
});

test('pool d6: maior, zero/negativo com menor e crítico somente com dados positivos', () => {
  assert.equal(rollCheck('d6Pool',{value:3},dice(2,5,3)).total,5);
  assert.equal(rollCheck('d6Pool',{value:0},dice(2,6)).total,2);
  assert.equal(rollCheck('d6Pool',{value:1,modifier:-2},dice(2,6)).total,2);
  assert.equal(rollCheck('d6Pool',{value:0},dice(6,6)).critical,false);
  assert.equal(rollCheck('d6Pool',{value:2},dice(6,6)).critical,true);
  assert.equal(rollCheck('d6Resistance',{value:2},dice(6,6)).stress,-1);
  assert.equal(rollCheck('d6Resistance',{value:0},dice(2,6)).stress,4);
  assert.throws(()=>rollCheck('d6Pool',{value:21}));
});
test('fontes de fórmula respeitam ajustes sem duplicar valores no personagem', () => {
  const config={sources:[{label:'Resistência',formula:'rating'}]};
  const system={formulas:{rating:'if(actions.a > 0, 1, 0) + if(actions.b > 0, 1, 0)'}};
  const character={actions:{a:3,b:0}};
  assert.equal(checkSources(config,character,system)[0].value,1);
  character.calculationOverrides={'computed.rating':{mode:'adjust',value:1}};
  assert.equal(checkSources(config,character,system)[0].value,2);
});

test('fonte fixa dispensa fórmula indisponível e erro em uma fonte não bloqueia as demais', () => {
  const config = {sources:[{label:'Base',field:'score'},{label:'Calculada',formula:'result'}]};
  const system = {formulas:{result:'6 / score'}};
  const character = {score:0,calculationOverrides:{'computed.result':{mode:'fixed',value:7}}};
  assert.equal(checkSources(config,character,system)[1].value,7);
  delete character.calculationOverrides;
  const sources = checkSources(config,character,system);
  assert.equal(sources[0].value,0);
  assert.equal(sources[1].value,undefined);
  assert.ok(sources[1].error);
});

test('SWADE: explosões separadas, maior dado, ampliação e falha crítica antes do bônus',()=>{
  const rolled=rollCheck('explodingTrait',{value:8,target:4},dice(8,8,2,6,3));
  assert.equal(rolled.total,18); assert.equal(rolled.raises,3);
  assert.equal(rollCheck('explodingTrait',{value:8,target:4,modifier:20},dice(1,1)).outcome,'Falha crítica');
  assert.equal(rollCheck('explodingTrait',{value:0,target:4,untrained:true},dice(2,5)).total,3);
  assert.equal(rollCheck('explodingTrait',{value:4,target:4,wild:false},dice(1,1)).critical,true);
  assert.equal(rollCheck('explodingTrait',{value:4,target:4,wild:false},dice(1,2)).critical,false);
  assert.equal(rollCheck('explodingDamage',{value:'1d4 + 1d6 + 2'},dice(4,3,6,2)).total,17);
  assert.throws(()=>rollCheck('explodingTrait',{value:4,target:4},sides=>sides),/100 dados/);
  assert.throws(()=>rollCheck('explodingTrait',{value:5,target:4}));
});

test('Ironsworn: teto 10, empate perde, ímpeto negativo e progresso sem dado de ação',()=>{
  assert.equal(rollCheck('challenge',{value:3,modifier:5},dice(6,10,9)).hits,1);
  assert.equal(rollCheck('challenge',{value:2,momentum:-3},dice(3,2,1)).hits,1);
  assert.equal(rollCheck('challenge',{value:2,momentum:-4},dice(3,2,1)).hits,2);
  const progress=rollCheck('progress',{value:39,momentum:-6},dice(9,9));
  assert.equal(progress.total,9); assert.equal(progress.hits,0); assert.equal(progress.match,true);
  assert.equal(rollCheck('progress',{value:40},dice(9,9)).hits,2);
  assert.throws(()=>rollCheck('progress',{value:41}));
  assert.throws(()=>rollCheck('progress',{value:40,modifier:1}));
});
