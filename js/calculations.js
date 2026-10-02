// calculations.js
// Resolve os valores derivados do personagem. Nenhuma fórmula de RPG fica
// hardcoded aqui — cada cálculo delega para a fórmula nomeada equivalente no
// system.json carregado (via engine/system.js). Trocar de sistema muda o
// resultado sem tocar neste arquivo nem no restante da interface.
import { calculationValue } from './engine/calculation-overrides.js';
import { getSkills, resolveFormula } from './engine/system.js';

export function abilityModifier(score, character, key, automatic = false) {
  const value = resolveFormula('abilityModifier', { value: Number(score) || 0 }) ?? 0;
  return automatic ? value : calculationValue(character, `dnd.ability.${key}`, value);
}

export function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonus(level, character, automatic = false) {
  const lvl = Math.max(1, Math.min(20, Number(level) || 1));
  const value = resolveFormula('proficiencyBonus', { level: lvl }) ?? 0;
  return automatic ? value : calculationValue(character, 'dnd.proficiency', value);
}

export function savingThrowModifier(character, abilityKey, automatic = false) {
  const score = character.abilities[abilityKey]?.score ?? 10;
  const mod = abilityModifier(score, character, abilityKey);
  const proficient = Boolean(character.savingThrows?.[abilityKey]?.proficient);
  const pb = proficiencyBonus(character.identity.level, character);
  const value = resolveFormula('savingThrow', { abilityModifier: mod, proficient, proficiencyBonus: pb }) ?? mod;
  return automatic ? value : calculationValue(character, `dnd.save.${abilityKey}`, value);
}

export function skillModifier(character, skillKey, automatic = false) {
  const skillDef = getSkills().find((s) => s.key === skillKey);
  if (!skillDef) return 0;
  const entry = character.skills?.[skillKey] || {};
  const abilityKey = entry.ability || skillDef.ability;
  const score = character.abilities[abilityKey]?.score ?? 10;
  const mod = abilityModifier(score, character, abilityKey);
  const pb = proficiencyBonus(character.identity.level, character);
  const value = resolveFormula('skillModifier', {
    abilityModifier: mod,
    proficient: Boolean(entry.proficient),
    expertise: Boolean(entry.expertise),
    proficiencyBonus: pb,
  }) ?? mod;
  return automatic ? value : calculationValue(character, `dnd.skill.${skillKey}`, value);
}

export function passivePerception(character, automatic = false) {
  const perceptionModifier = skillModifier(character, 'perception');
  const value = resolveFormula('passivePerception', { perceptionModifier }) ?? (10 + perceptionModifier);
  return automatic ? value : calculationValue(character, `dnd.passivePerception`, value);
}

export function passiveInvestigation(character, automatic = false) {
  const value = 10 + skillModifier(character, 'investigation');
  return automatic ? value : calculationValue(character, `dnd.passiveInvestigation`, value);
}

export function passiveInsight(character, automatic = false) {
  const value = 10 + skillModifier(character, 'insight');
  return automatic ? value : calculationValue(character, `dnd.passiveInsight`, value);
}

export function initiativeModifier(character, automatic = false) {
  const dexterityModifier = abilityModifier(character.abilities.dex?.score, character, 'dex');
  const initiativeBonus = Number(character.combat?.initiativeBonus) || 0;
  const value = resolveFormula('initiative', { dexterityModifier, initiativeBonus }) ?? dexterityModifier;
  return automatic ? value : calculationValue(character, `dnd.initiative`, value);
}

export function spellSaveDC(character, automatic = false) {
  const abilityKey = character.spellcasting?.ability;
  if (!abilityKey) return automatic ? null : calculationValue(character, 'dnd.spellSaveDC', null);
  const spellAbilityModifier = abilityModifier(character.abilities[abilityKey]?.score, character, abilityKey);
  const pb = proficiencyBonus(character.identity.level, character);
  const value = resolveFormula('spellSaveDC', { proficiencyBonus: pb, spellAbilityModifier }) ?? null;
  return automatic ? value : calculationValue(character, `dnd.spellSaveDC`, value);
}

export function spellAttackBonus(character, automatic = false) {
  const abilityKey = character.spellcasting?.ability;
  if (!abilityKey) return automatic ? null : calculationValue(character, 'dnd.spellAttackBonus', null);
  const spellAbilityModifier = abilityModifier(character.abilities[abilityKey]?.score, character, abilityKey);
  const pb = proficiencyBonus(character.identity.level, character);
  const value = resolveFormula('spellAttackBonus', { proficiencyBonus: pb, spellAbilityModifier }) ?? null;
  return automatic ? value : calculationValue(character, `dnd.spellAttackBonus`, value);
}

export function totalInventoryWeight(character, automatic = false) {
  const items = character.inventory?.items || [];
  const value = items.reduce((sum, item) => sum + (Number(item.weight) || 0) * (Number(item.qty) || 0), 0);
  return automatic ? value : calculationValue(character, `dnd.totalInventoryWeight`, value);
}

export function carryCapacity(character, automatic = false) {
  const strengthScore = character.abilities.str?.score ?? 10;
  const value = resolveFormula('carryCapacity', { strengthScore }) ?? 0;
  return automatic ? value : calculationValue(character, `dnd.carryCapacity`, value);
}

export function totalCurrencyValueInGp(character, automatic = false) {
  const c = character.inventory?.currency || {};
  const rates = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
  const value = Object.entries(rates).reduce((sum, [key, rate]) => sum + (Number(c[key]) || 0) * rate, 0);
  return automatic ? value : calculationValue(character, `dnd.totalCurrencyValueInGp`, value);
}

// O automático de um resultado preserva os ajustes de suas dependências.
export function dndCalculation(character, id, automatic = false) {
  const [kind, key] = id.split('.');
  if (kind === 'ability') return abilityModifier(character.abilities[key]?.score, character, key, automatic);
  if (kind === 'save') return savingThrowModifier(character, key, automatic);
  if (kind === 'skill') return skillModifier(character, key, automatic);
  const calculations = { proficiency: () => proficiencyBonus(character.identity.level, character, automatic),
    initiative: initiativeModifier, passivePerception, passiveInvestigation, passiveInsight,
    spellSaveDC, spellAttackBonus, totalInventoryWeight, carryCapacity, totalCurrencyValueInGp };
  return calculations[kind]?.(character, automatic);
}
