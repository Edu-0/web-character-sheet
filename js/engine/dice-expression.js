import { rollOne } from './dice-resolver.js';

// Gramática limitada a NdS e inteiros; nenhuma expressão vira código executável.
export function parseDiceExpression(text, { allowEmpty = false } = {}) {
  if (typeof text !== 'string' || text.length > 200) throw new Error('Use uma expressão de até 200 caracteres.');
  const source = text.replace(/\s+/g, '').toLowerCase();
  if (!source && allowEmpty) return { dice: [], modifier: 0 };
  if (!source || !/^[+\-]?(?:\d*d\d+|\d+)(?:[+\-](?:\d*d\d+|\d+))*$/.test(source)) throw new Error('Use dados e modificadores, como 3d6 + 4 ou 1d8 + 1d6 - 2.');
  const dice = [];
  let modifier = 0;
  for (const token of source.match(/[+\-]?(?:\d*d\d+|\d+)/g)) {
    const die = /^([+\-]?)(\d*)d(\d+)$/.exec(token);
    if (die) {
      const count = Number(die[2] || 1), sides = Number(die[3]);
      if (die[1] === '-' || !Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(sides) || sides < 2 || sides > 100000) throw new Error('Use 1 a 100 dados por grupo, com 2 a 100000 lados, sem subtrair dados.');
      dice.push({ count, sides });
    } else modifier += Number(token);
  }
  checkLimits({ dice, modifier });
  return { dice, modifier };
}

function checkLimits({ dice, modifier }) {
  if (!Array.isArray(dice) || dice.some(die => !Number.isInteger(die.count) || die.count < 1 || !Number.isInteger(die.sides) || die.sides < 2 || die.sides > 100000)) throw new Error('Grupos de dados inválidos.');
  if (dice.reduce((sum, die) => sum + die.count, 0) > 100 || !Number.isSafeInteger(modifier) || Math.abs(modifier) > 1000000) throw new Error('Limite: 100 dados por rolagem e modificador entre −1000000 e 1000000.');
}

export function scaleDiceExpression(base, extra, steps) {
  if (!Number.isInteger(steps) || steps < 0 || steps > 1000) throw new Error('Número de passos inválido.');
  const groups = new Map();
  for (const [expression, multiplier] of [[base, 1], [extra, steps]]) for (const die of expression.dice) {
    if (multiplier) groups.set(die.sides, (groups.get(die.sides) || 0) + die.count * multiplier);
  }
  const result = { dice: [...groups].map(([sides, count]) => ({ sides, count })), modifier: base.modifier + steps * extra.modifier };
  checkLimits(result);
  return result;
}

export function formatDiceExpression({ dice, modifier }) {
  const parts = dice.map(die => `${die.count}d${die.sides}`);
  if (modifier || !parts.length) parts.push(parts.length ? `${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)}` : String(modifier));
  return parts.join(' + ').replace(/ \+ ([+\-]) /g, ' $1 ');
}

export function evaluateDiceExpression(expression, rollDie = rollOne) {
  checkLimits(expression);
  const groups = expression.dice.map(die => ({ ...die, rolls: Array.from({ length: die.count }, () => rollDie(die.sides)) }));
  const rolls = groups.flatMap(group => group.rolls);
  return { formula: formatDiceExpression(expression), groups, rolls, modifier: expression.modifier, total: rolls.reduce((sum, value) => sum + value, expression.modifier) };
}
