import { pathKeys, getByPath } from '../engine/paths.js';
import { validateRollValueSource } from './entry-rolls.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const add = (issues, path, message) => issues.push({ path, message, code: 'invalid' });
function keys(value, allowed, path, issues) {
  if (!object(value)) { add(issues, path, 'deve ser objeto'); return false; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) add(issues, `${path}.${key}`, 'opção desconhecida');
  return true;
}
function path(value, label, issues) { try { pathKeys(value); } catch (error) { add(issues, label, error.message); } }
function text(value, label, issues) { if (typeof value !== 'string' || !value.trim() || value.length > 2000) add(issues, label, 'deve ser texto não vazio de até 2000 caracteres'); }
export function validateRecoveryActions(actions, system, issues, root = 'system.recoveryActions') {
  if (!Array.isArray(actions) || actions.length > 30) { add(issues, root, 'deve ser lista de até 30 ações'); return; }
  const ids = new Set();
  actions.forEach((config, index) => {
    const label = `${root}[${index}]`;
    if (!keys(config, ['id', 'label', 'help', 'confirmLabel', 'unavailableMessage', 'healing', 'operations'], label, issues)) return;
    path(config.id, `${label}.id`, issues); text(config.label, `${label}.label`, issues);
    if (ids.has(config.id)) add(issues, `${label}.id`, 'ID duplicado'); ids.add(config.id);
    for (const key of ['help', 'confirmLabel', 'unavailableMessage']) if (key in config) text(config[key], `${label}.${key}`, issues);
    if (config.healing !== undefined && keys(config.healing, ['field', 'maxField', 'totalField', 'usedField', 'dieField', 'modifier', 'minimum', 'requireCurrentMin', 'label'], `${label}.healing`, issues)) {
      const h = config.healing;
      for (const key of ['field', 'maxField', 'totalField', 'usedField', 'dieField']) {
        path(h[key], `${label}.healing.${key}`, issues);
        try {
          const value = getByPath(system.characterTemplate, h[key]);
          if (key === 'dieField' ? typeof value !== 'string' : !Number.isSafeInteger(value) || value < 0) add(issues, `${label}.healing.${key}`, 'campo do template incompatível com a recuperação');
        } catch {}
      }
      for (const key of ['minimum', 'requireCurrentMin']) if (key in h && (!Number.isSafeInteger(h[key]) || h[key] < 0 || h[key] > 1000000)) add(issues, `${label}.healing.${key}`, 'deve ser inteiro não negativo até 1000000');
      if (h.label !== undefined) text(h.label, `${label}.healing.label`, issues);
      if (h.modifier !== undefined) validateRollValueSource(h.modifier, `${label}.healing.modifier`, system, issues);
    }
    if (!Array.isArray(config.operations) || config.operations.length > 30) { add(issues, `${label}.operations`, 'deve ser lista de até 30 operações'); return; }
    config.operations.forEach((op, i) => {
      const opLabel = `${label}.operations[${i}]`;
      if (!keys(op, ['type', 'field', 'maxField', 'value', 'valueField', 'filterField', 'filterValues', 'requireCurrentMin', 'label'], opLabel, issues)) return;
      if (!['restoreValue', 'set', 'restoreCollection', 'setCollection'].includes(op.type)) add(issues, `${opLabel}.type`, 'operação de recuperação desconhecida');
      path(op.field, `${opLabel}.field`, issues);
      for (const key of ['maxField', 'valueField', 'filterField']) if (key in op) path(op[key], `${opLabel}.${key}`, issues);
      if (['restoreValue', 'restoreCollection'].includes(op.type) && !op.maxField) add(issues, `${opLabel}.maxField`, 'obrigatório');
      if (['restoreCollection', 'setCollection'].includes(op.type) && !op.valueField) add(issues, `${opLabel}.valueField`, 'obrigatório');
      if (op.type === 'set' && !['number', 'boolean', 'string'].includes(typeof op.value)) add(issues, `${opLabel}.value`, 'deve ser valor simples');
      if (op.type === 'setCollection' && (!Number.isSafeInteger(op.value) || op.value < 0 || op.value > 1000000)) add(issues, `${opLabel}.value`, 'deve ser inteiro não negativo');
      if (op.filterField && (!Array.isArray(op.filterValues) || !op.filterValues.length || op.filterValues.length > 30 || op.filterValues.some(value => !['number', 'string', 'boolean'].includes(typeof value)))) add(issues, `${opLabel}.filterValues`, 'exige lista não vazia de valores simples');
      if (op.requireCurrentMin !== undefined && (!Number.isSafeInteger(op.requireCurrentMin) || op.requireCurrentMin < 0)) add(issues, `${opLabel}.requireCurrentMin`, 'deve ser inteiro não negativo');
      if (op.label !== undefined) text(op.label, `${opLabel}.label`, issues);
      if (op.type === 'restoreValue') { try { if (!Number.isSafeInteger(getByPath(system.characterTemplate, op.maxField))) add(issues, `${opLabel}.maxField`, 'deve apontar para um inteiro do template'); } catch {} }
      try { if (getByPath(system.characterTemplate, op.field) === undefined) add(issues, `${opLabel}.field`, 'campo inexistente no template'); } catch {}
    });
  });
}
