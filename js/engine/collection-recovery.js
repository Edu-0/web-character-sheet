import { getByPath, setByPath } from './paths.js';

export function recoverCollection(list, config) {
  if (!Array.isArray(list)) throw new Error('Lista de recursos indisponível.');
  const updated = structuredClone(list);
  let count = 0;
  for (const item of updated) {
    if (config.filterField && !config.filterValues.includes(getByPath(item, config.filterField))) continue;
    const current = getByPath(item, config.valueField);
    const value = config.type === 'restoreCollection' ? getByPath(item, config.maxField) : config.value;
    if (![current, value].every(number => Number.isSafeInteger(number) && number >= 0 && number <= 1000000)) throw new Error('Recursos marcados: informe usos atuais e máximos inteiros válidos.');
    if (current !== value) { setByPath(item, config.valueField, value); count += 1; }
  }
  return { updated, count };
}
