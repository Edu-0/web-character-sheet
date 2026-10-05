import {RUNTIME_DEFAULTS} from './validation/contracts.js';
import { parseDiceExpression, evaluateDiceExpression } from './engine/dice-expression.js';
// dice.js
// Rolador rápido de dados usado pela bandeja de dados da interface. A resolução
// em si (o que significa "rolar") agora vive em engine/dice-resolver.js — este
// arquivo só mantém o histórico e a API já usada pela UI (roll/getHistory/clearHistory).
import { resolve } from './engine/dice-resolver.js';

const MAX_HISTORY = RUNTIME_DEFAULTS.historyLimit;
const history = [];
let sequence = 0;

export function roll({ sides, count = 1, modifier = 0, label = '' }) {
  return record(resolve({ type: 'dice', sides, count, modifier, label }));
}

export function rollExpression(expression, label = '') {
  const parsed = typeof expression === 'string' ? parseDiceExpression(expression) : expression;
  return record({ ...evaluateDiceExpression(parsed), label });
}

export function recordResult(result) { return record(result); }
function record(result) {
  const entry = {
    id: `${Date.now()}-${++sequence}`,
    label: result.label,
    formula: result.formula,
    rolls: result.rolls,
    ...(result.groups ? { groups: result.groups } : {}),
    modifier: result.modifier,
    total: result.total,
    ...(result.snapshot ? { snapshot: structuredClone(result.snapshot) } : {}),
    ...(result.outcome ? { outcome: result.outcome, detail: result.detail } : {}),
    resolution: structuredClone({schemaVersion:1,...result}),
    timestamp: new Date().toISOString(),
  };
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  return entry;
}

export function getHistory() {
  return history;
}

// Mantém a interpretação junto da expressão no histórico compartilhado.
export function recordCheck(result) {
  return record({ ...result, formula: `${result.formula} · ${result.outcome} · ${result.detail}` });
}

export function clearHistory() {
  history.length = 0;
}
