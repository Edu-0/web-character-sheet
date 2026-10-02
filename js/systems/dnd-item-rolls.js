// Somente derivados D&D e a ponte com a apresentação estática.
import { abilityModifier, spellAttackBonus, spellSaveDC } from '../calculations.js';
import { getSystem } from '../engine/system.js';
import { createEntryRollButton, registerRollValueResolver } from '../engine/entry-rolls.js';
import { registerEntryAction } from '../engine/entry-actions.js';

registerRollValueResolver('dnd.constitutionModifier', ({ character }) => abilityModifier(character.abilities?.con?.score ?? 10, character, 'con'));
registerRollValueResolver('dnd.spellAttackBonus', ({ character }) => spellAttackBonus(character));
registerRollValueResolver('dnd.spellSaveDC', ({ character }) => spellSaveDC(character));

export function createDndRollButton(context, kind) {
  const system = context.system || getSystem();
  const rollPreset = kind === 'spell' ? 'spell' : 'attack';
  return createEntryRollButton({ ...context, system, rollPreset }, system.entryRolls[rollPreset]);
}

registerEntryAction('dndSpell', context => createDndRollButton(context, 'spell'));
registerEntryAction('dndAttack', context => createDndRollButton(context, 'attack'));
