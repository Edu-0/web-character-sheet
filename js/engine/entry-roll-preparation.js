import {evaluateDiceExpression} from './dice-expression.js';
import {prepareRollCost} from './roll-cost.js';

// Tudo que pode falhar na resolução acontece antes de debitar ou editar opções.
export function prepareEntryRoll({expression, resource, context, selection, consume = false, phase}, die) {
  const payment = consume ? prepareRollCost(resource,context,selection) : null;
  const snapshot = structuredClone({schemaVersion:1,algorithm:'expression',source:{id:context.item.id,label:context.item.name || 'Ação',preset:context.rollPreset ?? context.rollConfigFrom},phase,
    expression,selection,cost:payment?.cost ?? 0,consume:Boolean(payment)});
  const result = expression ? {...evaluateDiceExpression(expression,die),snapshot} : null;
  return {result,payment,snapshot};
}
