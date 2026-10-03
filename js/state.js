// state.js
// Fonte única da verdade dos dados do personagem. Independente de HTML/CSS.
// As chaves de atributos/perícias vêm do system.json carregado (engine/system.js),
// não de uma lista fixa de D&D — outro sistema gera outra forma de personagem.
import { getByPath, setByPath } from './engine/paths.js';
import { createId } from './data.js';
import { getSystem } from './engine/system.js';
import { CharacterHistory } from './character-history.js';

export function createDefaultCharacter() {
  const system = getSystem();
  if (!system?.characterTemplate) throw new Error('O sistema atual não define characterTemplate.');
  const character = structuredClone(system.characterTemplate);
  const now = new Date().toISOString();
  character.meta = { ...character.meta, id: createId(), system: system.id, createdAt: now, updatedAt: now };
  return character;
}

class CharacterState {
  constructor() {
    // Vazio até state.load(...) ser chamado (após o system.json carregar em app.js) —
    // criar o personagem padrão aqui exigiria abilities/skills do sistema já carregados.
    this.character = {};
    this.listeners = new Set();
    this.history = new CharacterHistory();
    this.historyListeners = new Set();
    this.historyContext = null;
    this.replayingHistory = false;
    this.notifying = false;
  }

  load(character, { record = false, label = 'Substituir campos da ficha' } = {}) {
    if (record && (character.meta?.id !== this.character.meta?.id || character.meta?.system !== this.character.meta?.system)) throw new Error('A edição deve preservar a identidade do personagem.');
    this.character = character;
    if (!record) this.history.activate(character);
    this.notify(record ? { label } : null);
  }

  get() {
    return this.character;
  }

  getPath(path) {
    return getByPath(this.character, path);
  }

  setPath(path, value) {
    setByPath(this.character, path, value);
    this.notify();
  }

  // Helpers genéricos para listas dinâmicas (ataques, habilidades, magias, itens...)
  addItem(arrayPath, item) {
    const list = this.getPath(arrayPath);
    list.push({ id: createId(), ...item });
    this.notify();
  }

  removeItem(arrayPath, id) {
    const list = this.getPath(arrayPath);
    const index = list.findIndex((i) => i.id === id);
    if (index !== -1) list.splice(index, 1);
    this.notify();
  }

  moveItem(arrayPath, id, direction) {
    const list = this.getPath(arrayPath);
    const index = list.findIndex((i) => i.id === id);
    const newIndex = index + direction;
    if (index === -1 || newIndex < 0 || newIndex >= list.length) return;
    [list[index], list[newIndex]] = [list[newIndex], list[index]];
    this.notify();
  }

  updateItemField(arrayPath, id, field, value) {
    const list = this.getPath(arrayPath);
    const item = list.find((i) => i.id === id);
    if (item) item[field] = value;
    this.notify();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  syncHistoryBaseline() { if (!this.notifying) this.history.rebase(this.character); }
  subscribeHistory(fn) { this.historyListeners.add(fn); return () => this.historyListeners.delete(fn); }
  historyStatus() { return this.history.status(); }
  clearHistory() { this.history.clear(); this.historyListeners.forEach(fn => fn(this.history.status())); }
  replayHistory(direction, validate) {
    if (!this.history.apply(this.character, direction, validate)) return false;
    this.replayingHistory = true;
    try { this.notify(); } finally { this.replayingHistory = false; }
    return true;
  }

  notify(context = this.historyContext) {
    this.notifying = true;
    try { this.listeners.forEach((fn) => fn(this.character)); }
    finally {
      this.notifying = false;
      if (!this.replayingHistory) this.history.record(this.character, context || {});
      else this.history.rebase(this.character);
      this.historyListeners.forEach(fn => fn(this.history.status()));
    }
  }
}

export const state = new CharacterState();
