// engine/pool.js
// Resolvedor genérico de "Pool de dados": um conjunto de Traços (cada um com seu
// próprio dado) é rolado junto, e o resultado é decomposto em Ápice (maior
// resultado), Base (menor resultado) e Peso (Ápice + Base), deixando os dados
// restantes disponíveis para Potência. Nada aqui é específico de um sistema —
// qualquer RPG baseado em "maior dado, menor dado, resto disponível" pode usar
// isto (é o mesmo tipo de mecânica usada por jogos como Cortex Prime).
import { rollOne } from './dice-resolver.js';

/**
 * traits: [{ source, label, sides?, dice? }]  (dice = Traço Composto: soma vários dados)
 * Retorna cada entrada já rolada, mais os campos derivados apex/base/weight/remaining.
 */
export function rollPool(traits) {
  const rolls = traits.map((trait) => rollTrait(trait));
  return resolvePool(rolls);
}

function rollTrait(trait) {
  const components = trait.dice && trait.dice.length ? trait.dice : [{ sides: trait.sides }];
  const componentRolls = components.map((d) => ({ sides: d.sides, result: rollOne(d.sides) }));
  const result = componentRolls.reduce((sum, r) => sum + r.result, 0);
  // Um Traço Composto é representado, para fins de desempate, pelo maior de seus
  // dados — não há regra explícita além disso (ver comentário equivalente em
  // dice-resolver.js).
  const sides = Math.max(...componentRolls.map((r) => r.sides));
  return {
    source: trait.source,
    label: trait.label,
    sides,
    composite: components.length > 1,
    componentRolls,
    result,
  };
}

/**
 * Recebe traços já rolados (result + sides definidos) e aplica as regras de
 * Ápice/Base/Peso/desempate/Potência disponível. Separado de rollPool para
 * permitir testar a lógica com resultados fixos (ex.: reproduzir o exemplo de
 * empate da documentação sem depender de aleatoriedade).
 */
export function resolvePool(rolls) {
  if (!rolls.length) {
    return { rolls: [], apex: null, base: null, weight: 0, remaining: [], emptyPool: true };
  }
  if (rolls.length === 1) {
    const only = rolls[0];
    return { rolls, apex: only, base: only, weight: only.result, remaining: [], emptyPool: false };
  }
  const { chosen: apex, remaining: afterApex } = pickAndRemove(rolls, 'max');
  const { chosen: base, remaining: afterBase } = pickAndRemove(afterApex, 'min');
  const weight = apex.result + base.result;
  return { rolls, apex, base, weight, remaining: afterBase, emptyPool: false };
}

// "Quando houver empate no resultado, o dado de maior tamanho assume a função."
function pickAndRemove(list, extreme) {
  const values = list.map((r) => r.result);
  const target = extreme === 'max' ? Math.max(...values) : Math.min(...values);
  const candidates = list.filter((r) => r.result === target).sort((a, b) => b.sides - a.sides);
  const chosen = candidates[0];
  const index = list.indexOf(chosen);
  const remaining = [...list.slice(0, index), ...list.slice(index + 1)];
  return { chosen, remaining };
}

/**
 * Potência é o TAMANHO do dado escolhido entre os restantes, não o resultado
 * obtido nele. Com pools de 1 ou 2 dados não sobra nada para escolher — a
 * Potência é fixa em floorSides (o piso da escala, normalmente d4).
 */
export function potencyOptions(poolResult, floorSides) {
  if (poolResult.remaining.length === 0) return [{ sides: floorSides, forced: true }];
  return poolResult.remaining.map((r) => ({ sides: r.sides, source: r.source, forced: false }));
}
