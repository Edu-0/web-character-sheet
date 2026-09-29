// dice.js
// Sistema de rolagem de dados. Preparado para expansão (vantagem/desvantagem, múltiplos dados, modificadores).
const MAX_HISTORY = 20;
const history = [];

function rollOne(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function roll({ sides, count = 1, modifier = 0, label = '' }) {
  const rolls = Array.from({ length: count }, () => rollOne(sides));
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;
  const formulaParts = [`${count}d${sides}`];
  if (modifier) formulaParts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
  const entry = {
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    label,
    formula: formulaParts.join(' '),
    rolls,
    modifier,
    total,
    timestamp: new Date().toISOString(),
  };
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  return entry;
}

export function getHistory() {
  return history;
}

export function clearHistory() {
  history.length = 0;
}
