import { getByPath } from './paths.js';
import { evaluate } from './formula.js';
import { calculationValue } from './calculation-overrides.js';

const valueResolvers = new Map();
export function registerRollValueResolver(name, resolver) { valueResolvers.set(name, resolver); }

export function rollValue(source, context) {
  if (source === undefined) return undefined;
  let value;
  if (Object.hasOwn(source, 'value')) value = source.value;
  else if (source.itemField) value = getByPath(context.item, source.itemField);
  else if (source.field) value = getByPath(context.character, source.field);
  else if (source.resolver) {
    const resolve = valueResolvers.get(source.resolver);
    if (!resolve) throw new Error(`Resolvedor indisponível: ${source.resolver}.`);
    value = resolve(context);
  } else if (source.formula) {
    const formula = Object.hasOwn(context.system.formulas || {}, source.formula) ? context.system.formulas[source.formula] : undefined;
    if (!formula) throw new Error(`Fórmula indisponível: ${source.formula}.`);
    const vars = Object.fromEntries(Object.entries(source.variables || {}).map(([key, definition]) => [key, rollValue(definition, context)]));
    value = evaluate(formula, { vars, data: context.character });
  }
  if ((value == null || value === '') && Object.hasOwn(source, 'fallback')) value = source.fallback;
  return source.overrideKey ? calculationValue(context.character, source.overrideKey, value, { system: context.system }) : value;
}

// Read-only capability discovery for the authoring UI; execution is unchanged.
export function rollValueResolverNames(){return [...valueResolvers.keys()];}
