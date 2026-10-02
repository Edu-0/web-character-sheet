import { pathKeys } from '../engine/paths.js';
import { parseDiceExpression } from '../engine/dice-expression.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const add = (issues, path, message) => issues.push({ path, message, code: 'invalid' });
function keys(value, allowed, path, issues) {
  if (!object(value)) { add(issues, path, 'deve ser objeto'); return false; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) add(issues, `${path}.${key}`, 'opção desconhecida');
  return true;
}
function text(value, path, issues) {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) add(issues, path, 'deve ser texto não vazio de até 1000 caracteres');
}
function path(value, label, issues) {
  try { pathKeys(value); } catch (error) { add(issues, label, error.message); }
}
function source(value, label, system, issues, depth = 0) {
  if (!keys(value, ['value', 'field', 'itemField', 'formula', 'variables', 'overrideKey', 'resolver', 'fallback'], label, issues)) return;
  if (depth > 4) { add(issues, label, 'fonte excede profundidade 4'); return; }
  const origins = ['value', 'field', 'itemField', 'formula', 'resolver'].filter(key => Object.hasOwn(value, key));
  if (origins.length !== 1) add(issues, label, 'escolha uma única origem: value, field, itemField, formula ou resolver');
  if ('value' in value && !['number', 'string'].includes(typeof value.value)) add(issues, `${label}.value`, 'deve ser número ou texto');
  if ('fallback' in value && !['number', 'string'].includes(typeof value.fallback)) add(issues, `${label}.fallback`, 'deve ser número ou texto');
  for (const key of ['field', 'itemField', 'overrideKey', 'resolver', 'formula']) if (key in value) path(value[key], `${label}.${key}`, issues);
  if (value.formula && system && !Object.hasOwn(system.formulas || {}, value.formula)) add(issues, `${label}.formula`, 'fórmula inexistente no sistema');
  if (value.variables !== undefined) {
    if (!value.formula) add(issues, `${label}.variables`, 'variables exige formula');
    if (!object(value.variables) || Object.keys(value.variables).length > 32) add(issues, `${label}.variables`, 'deve ser objeto de até 32 variáveis');
    else for (const [key, definition] of Object.entries(value.variables)) {
      path(key, `${label}.variables.${key}`, issues);
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) add(issues, `${label}.variables.${key}`, 'nome de variável inválido');
      source(definition, `${label}.variables.${key}`, system, issues, depth + 1);
    }
  }
}
function expression(value, label, system, issues) {
  source(value, label, system, issues);
  if (object(value) && Object.hasOwn(value, 'value')) {
    try { parseDiceExpression(value.value, { allowEmpty: true }); } catch (error) { add(issues, `${label}.value`, error.message); }
  }
}
function labels(value, names, label, issues) { for (const name of names) if (name in value) text(value[name], `${label}.${name}`, issues); }

export function validateEntryRolls(definitions, system, issues) {
  if (!object(definitions) || Object.keys(definitions).length > 100) { add(issues, 'system.entryRolls', 'deve ser objeto de até 100 configurações'); return; }
  for (const [id, rawConfig] of Object.entries(definitions)) {
    const label = `system.entryRolls.${id}`;
    path(id, label, issues);
    if (!keys(rawConfig, ['buttonLabel', 'title', 'submitLabel', 'noRollMessage', 'help', 'check', 'test', 'effect', 'scale', 'resource', 'info'], label, issues)) continue;
    if (rawConfig.check !== undefined && rawConfig.test !== undefined) add(issues, `${label}.check`, 'use somente check; test é um nome anterior');
    const config = { ...rawConfig, check: rawConfig.check ?? rawConfig.test };
    labels(config, ['buttonLabel', 'title', 'submitLabel', 'noRollMessage', 'help'], label, issues);
    if (config.check !== undefined && keys(config.check, ['label', 'toggleLabel', 'expressionLabel', 'modifierLabel', 'enabled', 'expression', 'modifier'], `${label}.check`, issues)) {
      labels(config.check, ['label', 'toggleLabel', 'expressionLabel', 'modifierLabel'], `${label}.check`, issues);
      if ('enabled' in config.check && typeof config.check.enabled !== 'boolean') add(issues, `${label}.check.enabled`, 'deve ser booleano');
      expression(config.check.expression, `${label}.check.expression`, system, issues);
      if (config.check.modifier !== undefined) source(config.check.modifier, `${label}.check.modifier`, system, issues);
    }
    if (config.effect !== undefined && keys(config.effect, ['label', 'resultLabel', 'buttonLabel', 'expression'], `${label}.effect`, issues)) {
      labels(config.effect, ['label', 'resultLabel', 'buttonLabel'], `${label}.effect`, issues);
      if (config.effect.expression !== undefined) expression(config.effect.expression, `${label}.effect.expression`, system, issues);
    }
    if (config.scale !== undefined && keys(config.scale, ['base', 'min', 'max', 'step', 'label', 'incrementLabel', 'increment', 'noScaleHelp'], `${label}.scale`, issues)) {
      const scale = config.scale;
      labels(scale, ['label', 'incrementLabel', 'noScaleHelp'], `${label}.scale`, issues);
      source(scale.base, `${label}.scale.base`, system, issues);
      if (scale.increment !== undefined) expression(scale.increment, `${label}.scale.increment`, system, issues);
      const step = scale.step ?? 1;
      if (!Number.isInteger(scale.min) || scale.min < 0 || !Number.isInteger(scale.max) || scale.max > 1000 || scale.max < scale.min || !Number.isInteger(step) || step < 1 || (scale.max - scale.min) % step !== 0 || (scale.max - scale.min) / step > 100) add(issues, `${label}.scale`, 'escala inteira de 0 a 1000, passo positivo e até 101 opções, com extremos alinhados');
    }
    if (config.resource !== undefined && keys(config.resource, ['field', 'mode', 'matchField', 'valueField', 'maxField', 'cost', 'label', 'statusLabel', 'unavailableMessage'], `${label}.resource`, issues)) {
      const resource = config.resource;
      labels(resource, ['label', 'statusLabel', 'unavailableMessage'], `${label}.resource`, issues);
      path(resource.field, `${label}.resource.field`, issues);
      if (!['remaining', 'used'].includes(resource.mode)) add(issues, `${label}.resource.mode`, 'use remaining ou used');
      for (const key of ['matchField', 'valueField', 'maxField']) if (key in resource) path(resource[key], `${label}.resource.${key}`, issues);
      if (resource.mode === 'used' && !resource.maxField) add(issues, `${label}.resource.maxField`, 'obrigatório em used');
      if (resource.matchField && (!resource.valueField || !config.scale)) add(issues, `${label}.resource`, 'recurso em lista exige valueField e scale');
      if (resource.valueField && !resource.matchField) add(issues, `${label}.resource.valueField`, 'exige matchField');
      if (resource.cost !== undefined) {
        source(resource.cost, `${label}.resource.cost`, system, issues);
        if (object(resource.cost) && 'value' in resource.cost && (!Number.isSafeInteger(resource.cost.value) || resource.cost.value < 0 || resource.cost.value > 1000000)) add(issues, `${label}.resource.cost.value`, 'custo deve ser inteiro de 0 a 1000000');
      }
    }
    if (config.info !== undefined) {
      if (!Array.isArray(config.info) || config.info.length > 10) add(issues, `${label}.info`, 'deve ser lista de até 10 informações');
      else config.info.forEach((info, index) => {
        const infoLabel = `${label}.info[${index}]`;
        if (keys(info, ['label', 'source'], infoLabel, issues)) { text(info.label, `${infoLabel}.label`, issues); source(info.source, `${infoLabel}.source`, system, issues); }
      });
    }
  }
}

export function validateRollOptions(options, label, issues) {
  if (!keys(options, ['checkEnabled', 'checkExpression', 'testEnabled', 'testExpression', 'modifier', 'effect', 'increment', 'attack', 'attackModifier', 'upcast'], label, issues)) return;
  for (const [current, previous] of [['checkEnabled', 'testEnabled'], ['checkExpression', 'testExpression']]) if (current in options && previous in options) add(issues, `${label}.${current}`, `use somente ${current}; ${previous} é um nome anterior`);
  for (const key of ['checkEnabled', 'testEnabled', 'attack']) if (key in options && typeof options[key] !== 'boolean') add(issues, `${label}.${key}`, 'deve ser booleano');
  for (const key of ['modifier', 'attackModifier']) if (key in options && (typeof options[key] !== 'string' || options[key].length > 200)) add(issues, `${label}.${key}`, 'deve ser texto de até 200 caracteres');
  for (const key of ['checkExpression', 'testExpression', 'effect', 'increment', 'upcast']) if (key in options) {
    try { parseDiceExpression(options[key], { allowEmpty: true }); } catch (error) { add(issues, `${label}.${key}`, error.message); }
  }
}
