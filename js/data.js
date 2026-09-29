// data.js
// Tabelas de referência estáticas do sistema (D&D 5e 2024 como padrão inicial).
// Mantido separado da lógica para permitir trocar de "sistema" de RPG no futuro.

export const ABILITIES = [
  { key: 'str', label: 'Força', short: 'FOR' },
  { key: 'dex', label: 'Destreza', short: 'DES' },
  { key: 'con', label: 'Constituição', short: 'CON' },
  { key: 'int', label: 'Inteligência', short: 'INT' },
  { key: 'wis', label: 'Sabedoria', short: 'SAB' },
  { key: 'cha', label: 'Carisma', short: 'CAR' },
];

export const SKILLS = [
  { key: 'acrobatics', label: 'Acrobacia', ability: 'dex' },
  { key: 'animalHandling', label: 'Adestrar Animais', ability: 'wis' },
  { key: 'arcana', label: 'Arcanismo', ability: 'int' },
  { key: 'athletics', label: 'Atletismo', ability: 'str' },
  { key: 'deception', label: 'Enganação', ability: 'cha' },
  { key: 'history', label: 'História', ability: 'int' },
  { key: 'insight', label: 'Intuição', ability: 'wis' },
  { key: 'intimidation', label: 'Intimidação', ability: 'cha' },
  { key: 'investigation', label: 'Investigação', ability: 'int' },
  { key: 'medicine', label: 'Medicina', ability: 'wis' },
  { key: 'nature', label: 'Natureza', ability: 'int' },
  { key: 'perception', label: 'Percepção', ability: 'wis' },
  { key: 'performance', label: 'Atuação', ability: 'cha' },
  { key: 'persuasion', label: 'Persuasão', ability: 'cha' },
  { key: 'religion', label: 'Religião', ability: 'int' },
  { key: 'sleightOfHand', label: 'Prestidigitação', ability: 'dex' },
  { key: 'stealth', label: 'Furtividade', ability: 'dex' },
  { key: 'survival', label: 'Sobrevivência', ability: 'wis' },
];

export const HIT_DICE_TYPES = ['d6', 'd8', 'd10', 'd12'];

export const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];

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

// Peso (kg) que cada ponto de Força suporta — regra de referência, configurável.
export const CARRY_CAPACITY_PER_STR = 7.5;

export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const THEMES = [
  { key: 'dark', label: 'Escuro' },
  { key: 'light', label: 'Claro' },
];

export function createId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}
