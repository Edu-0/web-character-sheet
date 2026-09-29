// calculations.js
// Todas as fórmulas derivadas da ficha ficam centralizadas aqui.
import { SKILLS, CARRY_CAPACITY_PER_STR } from './data.js';

export function abilityModifier(score) {
  const s = Number(score) || 0;
  return Math.floor((s - 10) / 2);
}

export function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonus(level) {
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  return 2 + Math.floor((lvl - 1) / 4);
}

export function savingThrowModifier(character, abilityKey) {
  const score = character.abilities[abilityKey]?.score ?? 10;
  const mod = abilityModifier(score);
  const proficient = character.savingThrows?.[abilityKey]?.proficient;
  const pb = proficiencyBonus(character.identity.level);
  return mod + (proficient ? pb : 0);
}

export function skillModifier(character, skillKey) {
  const skillDef = SKILLS.find((s) => s.key === skillKey);
  if (!skillDef) return 0;
  const entry = character.skills?.[skillKey] || {};
  const abilityKey = entry.ability || skillDef.ability;
  const score = character.abilities[abilityKey]?.score ?? 10;
  const mod = abilityModifier(score);
  const pb = proficiencyBonus(character.identity.level);
  let bonus = 0;
  if (entry.expertise) bonus = pb * 2;
  else if (entry.proficient) bonus = pb;
  return mod + bonus;
}

export function passivePerception(character) {
  return 10 + skillModifier(character, 'perception');
}

export function passiveInvestigation(character) {
  return 10 + skillModifier(character, 'investigation');
}

export function passiveInsight(character) {
  return 10 + skillModifier(character, 'insight');
}

export function initiativeModifier(character) {
  const dexMod = abilityModifier(character.abilities.dex?.score);
  const misc = Number(character.combat?.initiativeBonus) || 0;
  return dexMod + misc;
}

export function spellSaveDC(character) {
  const abilityKey = character.spellcasting?.ability;
  if (!abilityKey) return null;
  const mod = abilityModifier(character.abilities[abilityKey]?.score);
  return 8 + proficiencyBonus(character.identity.level) + mod;
}

export function spellAttackBonus(character) {
  const abilityKey = character.spellcasting?.ability;
  if (!abilityKey) return null;
  const mod = abilityModifier(character.abilities[abilityKey]?.score);
  return proficiencyBonus(character.identity.level) + mod;
}

export function totalInventoryWeight(character) {
  const items = character.inventory?.items || [];
  return items.reduce((sum, item) => sum + (Number(item.weight) || 0) * (Number(item.qty) || 0), 0);
}

export function carryCapacity(character) {
  const str = character.abilities.str?.score ?? 10;
  return str * CARRY_CAPACITY_PER_STR;
}

export function totalCurrencyValueInGp(character) {
  const c = character.inventory?.currency || {};
  const rates = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
  return Object.entries(rates).reduce((sum, [key, rate]) => sum + (Number(c[key]) || 0) * rate, 0);
}
