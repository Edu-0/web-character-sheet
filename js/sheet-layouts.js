import { loadSettings, saveSettings } from './storage.js';
import { buildSearchIndex } from './engine/search.js';

// Preferência de apresentação por sistema; nunca integra o personagem.
export function preferredLayout(pkg) {
  const selections = loadSettings().layoutSelections;
  const id = Array.isArray(selections) ? selections.find(entry => entry?.systemId === pkg.system.id)?.layoutId : null;
  return pkg.layouts.find(layout => layout.id === id) || pkg.layouts[0];
}

export function rememberLayout(systemId, layoutId) {
  const settings = loadSettings();
  const selections = Array.isArray(settings.layoutSelections) ? settings.layoutSelections : [];
  return saveSettings({ ...settings, layoutSelections: [
    ...selections.filter(entry => entry?.systemId !== systemId), { systemId, layoutId },
  ] });
}

export function layoutName(layout) {
  return layout.name || layout.manifest?.name || layout.id;
}

export function printLayout(pkg, selected) {
  return selected.mode === 'table' ? pkg.layouts.find(layout => layout.mode !== 'table') || selected : selected;
}

// Prioriza o layout visível, mas mantém os campos das outras apresentações acessíveis.
export function layoutSearchIndex(pkg, selected, character) {
  const seen = new Set();
  return [selected, ...pkg.layouts.filter(layout => layout !== selected)].flatMap(layout =>
    buildSearchIndex(layout, character, pkg.system).filter(entry => {
      const key = JSON.stringify([entry.component.type, entry.component.field || entry.component.formula || entry.component.configFrom || entry.component.label, entry.label, entry.itemIndex, entry.itemField]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(entry => ({ ...entry, layoutId: layout.id, id: JSON.stringify([layout.id, entry.id]),
      location: layout === selected ? entry.location : `${entry.location} · ${layoutName(layout)}` }))
  );
}
