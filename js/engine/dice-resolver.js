// engine/dice-resolver.js
// Camada abstrata de resolução de dados. Cada "tipo" de resolução (dado simples,
// pool de dados, e futuramente sucessos/dificuldades/explosões/rerolls) se registra
// aqui — a engine nunca decide sozinha como um sistema resolve seus dados.
const resolvers = new Map();

export function registerResolver(type, fn) {
  resolvers.set(type, fn);
}

export function resolve(descriptor) {
  const fn = resolvers.get(descriptor.type);
  if (!fn) throw new Error(`Resolver de dados desconhecido: "${descriptor.type}"`);
  return fn(descriptor);
}

function rollOne(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// Resolver embutido: um único tipo de dado, N vezes, + modificador.
registerResolver('dice', ({ sides, count = 1, modifier = 0, label = '' }) => {
  const rolls = Array.from({ length: count }, () => rollOne(sides));
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;
  const parts = [`${count}d${sides}`];
  if (modifier) parts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
  return { label, formula: parts.join(' '), rolls, modifier, total };
});

// Resolver embutido: pool de dados de tamanhos variados (ex: Cortex Prime), sem
// regras de sucesso/dificuldade ainda — apenas os resultados brutos e a soma.
registerResolver('dicePool', ({ dice = [], label = '' }) => {
  const rolls = dice.map((d) => ({ sides: d.sides, result: rollOne(d.sides) }));
  const total = rolls.reduce((sum, r) => sum + r.result, 0);
  const formula = dice.map((d) => `d${d.sides}`).join(' + ');
  return { label, formula, rolls, total };
});
