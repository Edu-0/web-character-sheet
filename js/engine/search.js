import { getFieldType } from './fields.js';
import { getByPath } from './paths.js';
import { expandComponents, componentSearchKey } from './layout-components.js';
import { formatFieldValue as formatSearchValue } from './value-format.js';
export { formatFieldValue as formatSearchValue } from './value-format.js';

export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

// A busca lê os dados, nunca cadastra valores implícitos nem executa ações/rolagens.

function defaultEntries(component, character, system) {
  const label = component.label || component.heading || component.type;
  const value = component.field ? getByPath(character, component.field) : undefined;
  if (component.itemSchema && Array.isArray(value)) {
    return [
      { label, value: `${value.length} ${value.length === 1 ? 'item' : 'itens'}` },
      ...value.flatMap((item, itemIndex) => {
        const name = item?.name || `${label} ${itemIndex + 1}`;
        const fields = Object.entries(component.itemSchema).map(([key, definition]) => {
          const config = typeof definition === 'string' ? { type: definition, label: key } : definition;
          return { key, label: config.label || key, value: formatSearchValue(item?.[key] ?? config.default, config, { character, system }) };
        });
        return [
          { label: name, value: fields.filter((field) => field.key !== 'name' && field.value !== '—').map((field) => `${field.label}: ${field.value}`).join(' · ') || '—', itemIndex },
          ...fields.filter((field) => field.key !== 'name').map((field) => ({ label: `${name} · ${field.label}`, value: field.value, itemIndex, itemField: field.key })),
        ];
      }),
    ];
  }
  if (component.type === 'tagList' && Array.isArray(value)) return [{ label, value: value.join(', ') || '—' }, ...value.map((item) => ({ label: String(item), value: label }))];
  if (component.type === 'slotTracker' && Array.isArray(value)) return value.map((slot, itemIndex) => ({ label: `${label} · Nível ${slot.level}`, value: `${slot.used ?? 0} / ${slot.max ?? 0} usados`, itemIndex }));
  return [{ label, value: formatSearchValue(value ?? component.default ?? (['number', 'counter'].includes(component.type) ? 0 : undefined), component, { character, system }) }];
}

export function buildSearchIndex(layout, character, system) {
  const entries = [];
  for (const tab of layout?.tabs || []) for (const section of tab.sections || []) for (const container of section.containers || []) {
    expandComponents(container, system).forEach((component, index) => {
      if (component.searchable === false) return;
      const context = { ...component, character, system };
      const provider = getFieldType(component.type)?.search;
      let records;
      try { records = provider ? provider(context) : defaultEntries(component, character, system); }
      catch { records = [{ label: component.label || component.type, value: '—' }]; }
      (records || []).forEach((record, recordIndex) => {
        const key = componentSearchKey(section, container, index);
        const label = String(record.label || component.label || component.type);
        const value = String(record.value ?? '—');
        const location = [tab.label, section.title, record.category].filter(Boolean).join(' → ');
        entries.push({ ...record, id: JSON.stringify([tab.id, key, recordIndex]), label, value, location, tabId: tab.id, componentKey: key, component,
          name: normalizeSearch(label), content: normalizeSearch(value), context: normalizeSearch(`${location} ${component.label || ''} ${component.note || ''} ${(record.keywords || []).join(' ')}`) });
      });
    });
  }
  return entries;
}

// Distância de Damerau-Levenshtein limitada às palavras curtas dos rótulos.
function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}

export function searchEntries(entries, query) {
  const normalized = normalizeSearch(query).slice(0, 120);
  if (!normalized) return [];
  const terms = normalized.split(' ');
  return entries.map((entry) => {
    if (entry.name === normalized) return { ...entry, score: 0 };
    let score = 0;
    for (const term of terms) {
      if (entry.name.startsWith(term)) score += 10;
      else if (entry.name.includes(term)) score += 20;
      else if (entry.content.includes(term)) score += 30;
      else if (entry.context.includes(term)) score += 40;
      else {
        const tolerance = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
        if (!tolerance || term.length > 60) return null;
        const words = entry.name.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length <= 60 && Math.abs(word.length - term.length) <= tolerance);
        const best = Math.min(...words.map((word) => distance(term, word)));
        if (best > tolerance) return null;
        score += 50 + best;
      }
    }
    return { ...entry, score };
  }).filter(Boolean).sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, 'pt-BR'));
}

export function highlightSearchTarget(target) {
  if (!target) return;
  document.querySelectorAll('.search-target').forEach((node) => node.classList.remove('search-target'));
  target.classList.add('search-target');
  if (!target.matches('input, select, textarea, button, summary, [tabindex]')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
  setTimeout(() => target.classList.remove('search-target'), 2400);
}
