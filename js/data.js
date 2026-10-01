// data.js
// Constantes genéricas de interface que NÃO são regra de sistema de RPG
// (por isso não vivem em data/systems/*.system.json). Atributos, perícias,
// dados disponíveis e fórmulas de um sistema específico agora vêm de
// engine/system.js (carregado a partir de um system.json em runtime).

export const HIT_DICE_TYPES = ['d6', 'd8', 'd10', 'd12'];

export const ITEM_CATEGORIES = [
  'Equipamento', 'Arma', 'Armadura', 'Item Mágico', 'Consumível', 'Ferramenta', 'Tesouro', 'Outro',
];

export const CURRENCY_KEYS = [
  { key: 'pp', label: 'PP' },
  { key: 'gp', label: 'PO' },
  { key: 'ep', label: 'PE' },
  { key: 'sp', label: 'PP(prata)' },
  { key: 'cp', label: 'PC' },
];

export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const THEMES = [
  { key: 'dark', label: 'Escuro' },
  { key: 'light', label: 'Claro' },
];

export const PALETTES = [
  { key: 'classic', label: 'Clássico', description: 'Papel e bronze, para uma ficha de aventura clássica.' },
  { key: 'editorial', label: 'Editorial', description: 'Tons neutros e azul, com foco na leitura.' },
  { key: 'forest', label: 'Floresta', description: 'Verde profundo e cobre, com uma atmosfera natural.' },
];


export function createId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}
