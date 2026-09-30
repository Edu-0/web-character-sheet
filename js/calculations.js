// calculations.js
// Resolve os valores derivados do personagem. Nenhuma fórmula de RPG fica
// hardcoded aqui — cada cálculo delega para a fórmula nomeada equivalente no
// system.json carregado (via engine/system.js). Trocar de sistema muda o
// resultado sem tocar neste arquivo nem no restante da interface.
import { getSkills, resolveFormula } from './engine/system.js';

export function abilityModifier(score) {
  return resolveFormula('abilityModifier', { value: Number(score) || 0 }) ?? 0;
}

export function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonus(level) {
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  return resolveFormula('proficiencyBonus', { level: lvl }) ?? 0;
}

export function savingThrowModifier(character, abilityKey) {
  const score = character.abilities[abilityKey]?.score ?? 10;
  const mod = abilityModifier(score);
  const proficient = Boolean(character.savingThrows?.[abilityKey]?.proficient);
  const pb = proficiencyBonus(character.identity.level);
  return resolveFormula('savingThrow', { abilityModifier: mod, proficient, proficiencyBonus: pb }) ?? mod;
}

export function skillModifier(character, skillKey) {
  const skillDef = getSkills().find((s) => s.key === skillKey);
  if (!skillDef) return 0;
  const entry = character.skills?.[skillKey] || {};
  const abilityKey = entry.ability || skillDef.ability;
  const score = character.abilities[abilityKey]?.score ?? 10;
  const mod = abilityModifier(score);
  const pb = proficiencyBonus(character.identity.level);
  return resolveFormula('skillModifier', {
    abilityModifier: mod,
    proficient: Boolean(entry.proficient),
    expertise: Boolean(entry.expertise),
    proficiencyBonus: pb,
  }) ?? mod;
}

export function passivePerception(character) {
  const perceptionModifier = skillModifier(character, 'perception');
  return resolveFormula('passivePerception', { perceptionModifier }) ?? (10 + perceptionModifier);
}

export function passiveInvestigation(character) {
  return 10 + skillModifier(character, 'investigation');
}

export function passiveInsight(character) {
  return 10 + skillModifier(character, 'insight');
}

export function initiativeModifier(character) {
  const dexterityModifier = abilityModifier(character.abilities.dex?.score);
  const initiativeBonus = Number(character.combat?.initiativeBonus) || 0;
  return resolveFormula('initiative', { dexterityModifier, initiativeBonus }) ?? dexterityModifier;
}

export function spellSaveDC(character) {
  const abilityKey = character.spellcasting?.ability;
  if (!abilityKey) return null;
  const spellAbilityModifier = abilityModifier(character.abilities[abilityKey]?.score);
  const pb = proficiencyBonus(character.identity.level);
  return resolveFormula('spellSaveDC', { proficiencyBonus: pb, spellAbilityModifier }) ?? null;
}

export function spellAttackBonus(character) {
  const abilityKey = character.spellcasting?.ability;
  if (!abilityKey) return null;
  const spellAbilityModifier = abilityModifier(character.abilities[abilityKey]?.score);
  const pb = proficiencyBonus(character.identity.level);
  return resolveFormula('spellAttackBonus', { proficiencyBonus: pb, spellAbilityModifier }) ?? null;
}

export function totalInventoryWeight(character) {
  const items = character.inventory?.items || [];
  return items.reduce((sum, item) => sum + (Number(item.weight) || 0) * (Number(item.qty) || 0), 0);
}

export function carryCapacity(character) {
  const strengthScore = character.abilities.str?.score ?? 10;
  return resolveFormula('carryCapacity', { strengthScore }) ?? 0;
}

export function totalCurrencyValueInGp(character) {
  const c = character.inventory?.currency || {};
  const rates = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
  return Object.entries(rates).reduce((sum, [key, rate]) => sum + (Number(c[key]) || 0) * rate, 0);
}
