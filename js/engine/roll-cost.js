import { getByPath, setByPath } from './paths.js';
import { rollValue } from './roll-values.js';
const integer = (value, label, { min = -1000000, max = 1000000 } = {}) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}: informe um inteiro entre ${min} e ${max}.`);
  return value;
};

// Confere a disponibilidade inteira antes de devolver uma única mutação.
export function prepareRollCost(resource, context, selection, requireAvailable = true) {
  if (!resource) return null;
  // Custos não recebem efeitos temporários, inclusive nas dependências do resolvedor.
  const cost = integer(rollValue(resource.cost || { value: 1 }, { ...context, character: { ...context.character, activeEffects: [] } }), 'Custo', { min: 0 });
  let target = context.character;
  let field = resource.field;
  if (resource.matchField) {
    const list = getByPath(target, resource.field);
    if (!Array.isArray(list)) throw new Error('Lista de recursos indisponível.');
    const matches = list.filter(entry => getByPath(entry, resource.matchField) === selection);
    if (matches.length !== 1) throw new Error(resource.unavailableMessage || 'Recurso indisponível para a opção escolhida.');
    target = matches[0]; field = resource.valueField;
  }
  const current = integer(getByPath(target, field), 'Recurso', { min: 0 });
  const max = resource.mode === 'used' ? integer(getByPath(target, resource.maxField), 'Máximo do recurso', { min: 0 }) : current;
  const remaining = resource.mode === 'used' ? max - current : current;
  if (remaining < 0) throw new Error('Recurso utilizado excede o máximo.');
  if (requireAvailable && remaining < cost) throw new Error(resource.unavailableMessage || 'Recurso insuficiente. Desmarque o consumo ou escolha outro valor.');
  return { remaining, max, cost, apply: () => {
    if (getByPath(target,field) !== current || resource.matchField && !getByPath(context.character,resource.field)?.includes(target)) throw new Error('O recurso mudou durante a preparação; revise os valores.');
    setByPath(target, field, resource.mode === 'used' ? current + cost : current - cost);
  } };
}
