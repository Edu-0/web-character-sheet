import { getByPath, setByPath } from './paths.js';
import { rollValue } from './entry-rolls.js';
import { parseDiceExpression } from './dice-expression.js';
import { rollOne } from './dice-resolver.js';
import { executeSheetAction } from './assistance.js';

function integer(value, label, min = 0) {
  if (!Number.isSafeInteger(value) || value < min || value > 1000000) throw new Error(`${label}: informe um inteiro válido.`);
  return value;
}

export function recoveryDie(context, config, manual) {
  const healing = config.healing;
  const total = integer(getByPath(context.character, healing.totalField), 'Total de dados');
  const used = integer(getByPath(context.character, healing.usedField), 'Dados usados');
  if (used >= total) throw new Error('Não há dados de recuperação disponíveis.');
  if (manual !== '') return Math.max(healing.minimum ?? 0, integer(Number(manual), 'Recuperação informada'));
  const die = parseDiceExpression(getByPath(context.character, healing.dieField));
  if (die.dice.length !== 1 || die.dice[0].count !== 1 || die.modifier !== 0) throw new Error('Configure um único dado de recuperação ou informe o resultado da mesa.');
  const modifier = integer(rollValue(healing.modifier || { value: 0 }, context), 'Modificador', -1000000);
  return Math.max(healing.minimum ?? 0, rollOne(die.dice[0].sides) + modifier);
}

// Monta a prévia sem escrever no personagem ou rolar dados.
export function recoveryPlan(context, config, rolls = []) {
  const draft = structuredClone(context.character);
  const effects = [], details = [];
  const write = (field, value, label) => {
    const before = getByPath(draft, field);
    if (JSON.stringify(before) === JSON.stringify(value)) return;
    setByPath(draft, field, value);
    effects.push({ type: 'set', field, value: structuredClone(value) });
    details.push(`${label}: ${Array.isArray(value) ? 'recuperação dos recursos marcados' : `${before ?? '—'} → ${value}`}.`);
  };
  if (config.healing) {
    const h = config.healing;
    const current = integer(getByPath(draft, h.field), 'Valor atual');
    const max = integer(getByPath(draft, h.maxField), 'Máximo');
    const used = integer(getByPath(draft, h.usedField), 'Dados usados');
    const total = integer(getByPath(draft, h.totalField), 'Total de dados');
    if (current < (h.requireCurrentMin ?? 0)) throw new Error(config.unavailableMessage || 'O recurso atual não atende ao requisito da recuperação.');
    if (used > total || rolls.length > total - used) throw new Error('Não há dados de recuperação suficientes.');
    rolls.forEach(value => integer(value, 'Recuperação'));
    write(h.field, Math.min(max, current + rolls.reduce((sum, value) => sum + value, 0)), h.label || 'Recuperação');
    write(h.usedField, used + rolls.length, 'Dados usados');
    if (rolls.length) details.push(`Recuperação por dado: ${rolls.join(', ')}.`);
  }
  for (const op of config.operations || []) {
    if (op.type === 'restoreValue') {
      const current = integer(getByPath(draft, op.field), op.label || 'Valor atual');
      const max = integer(getByPath(draft, op.maxField), op.label || 'Máximo');
      if (current < (op.requireCurrentMin ?? 0)) throw new Error(config.unavailableMessage || 'O recurso atual não atende ao requisito da recuperação.');
      write(op.field, max, op.label || 'Recurso');
    } else if (op.type === 'set') write(op.field, structuredClone(op.value), op.label || 'Recurso');
    else if (op.type === 'restoreCollection' || op.type === 'setCollection') {
      const list = getByPath(draft, op.field);
      if (!Array.isArray(list)) throw new Error('Lista de recursos indisponível.');
      const updated = structuredClone(list);
      let count = 0;
      for (const item of updated) {
        if (op.filterField && !op.filterValues.includes(getByPath(item, op.filterField))) continue;
        const current = integer(getByPath(item, op.valueField), op.label || 'Recurso');
        const value = op.type === 'restoreCollection' ? integer(getByPath(item, op.maxField), op.label || 'Máximo') : integer(op.value, op.label || 'Valor');
        if (current !== value) { setByPath(item, op.valueField, value); count += 1; }
      }
      if (count) write(op.field, updated, `${op.label || 'Recursos'} (${count})`);
    } else throw new Error(`Operação de recuperação desconhecida: ${op.type}.`);
  }
  return { effects, details };
}

export function applyRecovery(context, config, rolls, baseline) {
  const plan = recoveryPlan({ ...context, character: baseline }, config, rolls);
  if (plan.effects.some(effect => JSON.stringify(getByPath(context.character, effect.field)) !== JSON.stringify(getByPath(baseline, effect.field)))) throw new Error('A ficha mudou enquanto este painel estava aberto. Feche e abra novamente para revisar os valores.');
  const event = executeSheetAction(context.character, { id: config.id, label: config.label, effects: plan.effects }, context.system);
  event.details = plan.details;
  return event;
}
