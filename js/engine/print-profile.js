// Metadados de apresentação pertencem ao layout, sem inferir nomes de sistemas.
import { expandComponents } from './layout-components.js';
export const normalizePrintProfile = value => value === 'compact' ? 'compact' : 'full';

export function printOptions(definition, profile) {
  return profile === 'compact' ? definition.print?.compact || {} : {};
}

export function componentsForPrint(container, system, profile) {
  if (printOptions(container, profile).include === false) return [];
  return expandComponents(container, system).flatMap(component => {
    const options = printOptions(component, profile);
    if (options.include === false) return [];
    const itemSchema = options.fields && component.itemSchema
      ? Object.fromEntries(options.fields.map(key => [key, component.itemSchema[key]]))
      : component.itemSchema;
    return [{ ...component, itemSchema, printProfile: profile, printPresentation: options.presentation }];
  });
}
