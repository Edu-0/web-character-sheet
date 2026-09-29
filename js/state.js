// state.js
// Fonte única da verdade dos dados do personagem. Independente de HTML/CSS.
import { SKILLS, createId } from './data.js';

function defaultSavingThrows() {
  const out = {};
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((k) => {
    out[k] = { proficient: false };
  });
  return out;
}

function defaultSkills() {
  const out = {};
  SKILLS.forEach((s) => {
    out[s.key] = { proficient: false, expertise: false };
  });
  return out;
}

function defaultSpellSlots() {
  return Array.from({ length: 9 }, (_, i) => ({ level: i + 1, max: 0, used: 0 }));
}

export function createDefaultCharacter() {
  return {
    meta: { version: 1, id: createId(), system: 'dnd5e-2024' },
    identity: {
      name: '',
      player: '',
      class: '',
      level: 1,
      species: '',
      background: '',
      alignment: '',
      experience: 0,
      inspiration: false,
      portrait: null,
    },
    abilities: {
      str: { score: 10 },
      dex: { score: 10 },
      con: { score: 10 },
      int: { score: 10 },
      wis: { score: 10 },
      cha: { score: 10 },
    },
    savingThrows: defaultSavingThrows(),
    skills: defaultSkills(),
    combat: {
      ac: 10,
      initiativeBonus: 0,
      speed: 9,
      hpMax: 10,
      hpCurrent: 10,
      hpTemp: 0,
      hitDice: { total: 1, die: 'd8', used: 0 },
      attacks: [],
      conditions: [],
    },
    spellcasting: {
      ability: '',
      slots: defaultSpellSlots(),
      spells: [],
    },
    inventory: {
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      items: [],
    },
    features: [],
    personality: {
      traits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      appearance: '',
      backstory: '',
      allies: '',
      notes: '',
    },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
      other: [],
    },
    diceHistory: [],
  };
}

class CharacterState {
  constructor() {
    this.character = createDefaultCharacter();
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
    return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), this.character);
  }

  setPath(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((obj, key) => {
      if (obj[key] == null) obj[key] = {};
      return obj[key];
    }, this.character);
    target[last] = value;
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
