import { getByPath } from './paths.js';
import { traitLabel } from './traits.js';

// Formatos compartilhados por busca e documentos de leitura.
export function formatFieldValue(value, definition = {}, { character, system } = {}) {
  if (definition.type === 'image') return value ? 'Retrato definido' : 'Sem retrato';
  if (definition.type === 'die') return traitLabel(value);
  if (definition.type === 'resource') return `${value?.current ?? 0} / ${value?.max ?? 0}`;
  if (definition.type === 'boolean' || typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value == null || value === '') return '—';
  let options = definition.options;
  if (!options && definition.optionsFrom) {
    const [scope, ...parts] = definition.optionsFrom.split('.');
    options = getByPath(scope === 'character' ? character : system, parts.join('.'));
  }
  if (definition.type === 'reference') options = character?.techniques || [];
  if (Array.isArray(options)) {
    const match = options.find((option) => String(option?.value ?? option?.id ?? option) === String(value));
    if (match != null) return String(match.label ?? match.name ?? match);
  }
  if (Array.isArray(value)) return value.map((item) => formatFieldValue(item, definition, { character, system })).join(', ') || '—';
  if (typeof value === 'object') return Object.values(value).map((item) => formatFieldValue(item)).join(' · ');
  return String(value);
}

