// dice.js
// Rolador rápido de dados usado pela bandeja de dados da interface. A resolução
// em si (o que significa "rolar") agora vive em engine/dice-resolver.js — este
// arquivo só mantém o histórico e a API já usada pela UI (roll/getHistory/clearHistory).
import { resolve } from './engine/dice-resolver.js';

const MAX_HISTORY = 20;
const history = [];

export function roll({ sides, count = 1, modifier = 0, label = '' }) {
  const result = resolve({ type: 'dice', sides, count, modifier, label });
  const entry = {
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    label: result.label,
    formula: result.formula,
    rolls: result.rolls,
    modifier: result.modifier,
    total: result.total,
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
