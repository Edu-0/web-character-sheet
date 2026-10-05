import {getByPath} from './paths.js';
import {evaluate} from './formula.js';
import {traitMaximum} from './traits.js';
import {calculationValue, getCalculationOverride} from './calculation-overrides.js';

export function computedKey(context) { return `computed.${context.overrideKey || context.formula}`; }
export function computedVariables(definitions = {}, character, system) {
  return Object.fromEntries(Object.entries(definitions).map(([key, definition]) => [key,
    definition.traitMaxField ? traitMaximum(getByPath(character,definition.traitMaxField))
      : definition.field ? getByPath(character,definition.field) ?? 0
      : definition.system ? getByPath(system,definition.system) ?? 0 : definition.rollField ? 0 : definition.value ?? 0]));
}
export function computedValue(context, automatic = false) {
  const entry = getCalculationOverride(context.character,computedKey(context));
  if (!automatic && context.override !== false && entry?.mode === 'fixed') return entry.value;
  const value = evaluate(context.system.formulas[context.formula],{vars:computedVariables(context.variables,context.character,context.system),data:context.character});
  return automatic || context.override === false ? value : calculationValue(context.character,computedKey(context),value,{system:context.system});
}
