import { recoverCollection } from './collection-recovery.js';
import { calculationValue } from './calculation-overrides.js';
import { getByPath, setByPath } from './paths.js';
import { traitDice, traitMaximum } from './traits.js';
import { rollOne } from './dice-resolver.js';

export function inventoryCalculationKey(config, stat) {
  return config.overrideKeys?.[stat] || `inventory.${config.overrideKey || config.field}.${stat}`;
}

export function inventoryTotals(character, config, automaticStat = null) {
  const items = getByPath(character, config.field) || [];
  let weight = items.reduce((sum, item) => {
    if (config.carriedField && item[config.carriedField] === false) return sum;
    return sum + Math.max(0, Number(item[config.weightField]) || 0) * Math.max(0, Number(item[config.quantityField]) || 0);
  }, 0);
  let capacity = traitMaximum(getByPath(character, config.strengthField)) * Math.max(0, Number(getByPath(character, config.multiplierField)) || 0);
  const resolve = (stat, value) => automaticStat === stat || config.override === false ? value : calculationValue(character, inventoryCalculationKey(config, stat), value);
  weight = resolve('weight', weight);
  capacity = resolve('capacity', capacity);
  return { weight, capacity, excess: resolve('excess', Math.max(0, weight - capacity)) };
}

export function repertoireStatus(character, system, config) {
  return (getByPath(character, config.specializationsField) || []).map((specialization) => {
    const grade = specialization[config.gradeField];
    const definition = getByPath(system, config.progressionFrom)?.[grade];
    const techniques = (getByPath(character, config.techniquesField) || []).filter((item) => item[config.linkField] === specialization.id);
    const slots = (definition?.grants || []).flatMap((slot) => Array(slot.count).fill(slot.sides)).sort((a, b) => a - b);
    let excess = 0;
    techniques.filter((item) => (item.learningSource || 'repertoire') === 'repertoire').sort((a, b) => b.maxDie - a.maxDie).forEach((technique) => {
      const index = slots.findIndex((sides) => sides >= traitMaximum(technique.maxDie));
      if (index < 0) excess += 1;
      else slots.splice(index, 1);
    });
    return { specialization, definition, techniques, remaining: slots, excess };
  });
}

export function reduceStateGrade(grade, steps, scale) {
  const index = scale.indexOf(grade);
  if (index < 0) return grade;
  return index - steps < 0 ? null : scale[index - steps];
}

export function healState(grade, potency, success, scale, limited = false) {
  if (!success) return grade;
  return !limited && potency > grade ? null : reduceStateGrade(grade, 1, scale);
}

// Execução transacional de operações declarativas. Um erro não altera a ficha.
export function executeSheetAction(character, action, system) {
  const draft = structuredClone(character);
  const touched = new Set();
  const details = [];
  (action.requirements || []).forEach((requirement) => {
    const value = getByPath(draft, requirement.field);
    if ((requirement.min !== undefined && (!Number.isFinite(Number(value)) || Number(value) < requirement.min)) || (requirement.equals !== undefined && value !== requirement.equals)) {
      throw new Error(requirement.message || 'O requisito desta ação não foi atendido.');
    }
  });
  (action.effects || action.operations || []).forEach((effect) => {
    touched.add(effect.field);
    if (effect.type === 'set') setByPath(draft, effect.field, structuredClone(effect.value));
    else if (effect.type === 'add') setByPath(draft, effect.field, Math.max(effect.min ?? -Infinity, (Number(getByPath(draft, effect.field)) || 0) + effect.amount));
    else if (effect.type === 'restoreCollection' || effect.type === 'setCollection') {
      const { updated, count } = recoverCollection(getByPath(draft, effect.field), effect);
      setByPath(draft, effect.field, updated);
      details.push(`${effect.label || 'Recursos'}: ${count} recuperado(s).`);
    }
    else if (effect.type === 'restoreResource' || effect.type === 'rollResource') {
      const resource = getByPath(draft, effect.field);
      if (!resource) throw new Error('Recurso não encontrado.');
      const rolls = effect.type === 'rollResource'
        ? (getByPath(draft, effect.sourceField) || []).flatMap((item) => traitDice(item[effect.dieField])).map((sides) => rollOne(sides))
        : [];
      const recovered = rolls.reduce((sum, value) => sum + value, 0);
      const before = Number(resource.current) || 0;
      resource.current = effect.type === 'restoreResource' ? Math.max(0, Number(resource.max) || 0) : Math.min(Math.max(0, Number(resource.max) || 0), before + recovered);
      details.push(`${effect.label || 'Recurso'}: ${before} → ${resource.current}${rolls.length ? ` (rolagens ${rolls.join(' + ')})` : ''}.`);
    } else if (effect.type === 'reduceNamedStates' || effect.type === 'clearNamedStates') {
      const states = getByPath(draft, effect.field) || [];
      const names = (effect.names || [effect.name]).map((name) => String(name).trim().toLocaleLowerCase('pt-BR'));
      const updated = states.flatMap((state) => {
        if (!names.includes(String(state.name || '').trim().toLocaleLowerCase('pt-BR')) || state[effect.recoverableField || 'recoverable'] === false) return [state];
        const grade = effect.type === 'clearNamedStates' ? null : reduceStateGrade(state[effect.gradeField || 'sides'], effect.steps || 1, system.dieScale || []);
        return grade === null ? [] : [{ ...state, [effect.gradeField || 'sides']: grade }];
      });
      setByPath(draft, effect.field, updated);
    } else throw new Error(`Operação de ficha desconhecida: ${effect.type}`);
  });
  const changes = [...touched].map((field) => ({ field, before: structuredClone(getByPath(character, field) ?? null), after: structuredClone(getByPath(draft, field) ?? null) }));
  changes.forEach((change) => setByPath(character, change.field, structuredClone(change.after)));
  return { id: action.id, label: action.label, date: new Date().toISOString(), changes, details };
}

export function undoSheetAction(character, event) {
  if (!event?.changes?.length) return false;
  if (event.changes.some((change) => JSON.stringify(getByPath(character, change.field) ?? null) !== JSON.stringify(change.after))) return false;
  event.changes.forEach((change) => setByPath(character, change.field, structuredClone(change.before)));
  return true;
}
