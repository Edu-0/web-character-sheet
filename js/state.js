// state.js
// Fonte única da verdade dos dados do personagem. Independente de HTML/CSS.
// As chaves de atributos/perícias vêm do system.json carregado (engine/system.js),
// não de uma lista fixa de D&D — outro sistema gera outra forma de personagem.
import { getByPath, setByPath } from './engine/paths.js';
import { createId } from './data.js';
import { getSystem } from './engine/system.js';

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
  }

  load(character) {
    this.character = character;
    this.notify();
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

  notify() {
    this.listeners.forEach((fn) => fn(this.character));
  }
}

export const state = new CharacterState();
