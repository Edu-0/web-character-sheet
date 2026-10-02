import { getByPath } from '../engine/paths.js';
// Destinos da busca para a apresentação estática; o índice é o mesmo da modular.
import { highlightSearchTarget } from '../engine/search.js';

const derivedIds = {
  proficiency: 'stat-proficiency', initiative: 'stat-initiative', passivePerception: 'stat-passive-perception',
  spellSaveDC: 'stat-spell-dc', spellAttackBonus: 'stat-spell-attack', totalInventoryWeight: 'stat-total-weight', carryCapacity: 'stat-carry-capacity',
};
const collectionIds = { 'combat.attacks': 'attacks-list', features: 'features-list', 'spellcasting.spells': 'spells-list', 'inventory.items': 'inventory-tbody', 'spellcasting.slots': 'spell-slots' };
const tagIds = { 'combat.conditions': 'conditions-tag-list', 'proficiencies.armor': 'tags-armor', 'proficiencies.weapons': 'tags-weapons', 'proficiencies.tools': 'tags-tools', 'proficiencies.languages': 'tags-languages', 'proficiencies.other': 'tags-other' };

export function revealDndSearchResult(entry, character, controller) {
  controller.activate(entry.tabId, { focus: false });
  const root = document.getElementById('legacy-dnd-sheet');
  const component = entry.component;
  let target;
  if (component.type === 'dndSkill') target = [...root.querySelectorAll('[data-skill]')].find((node) => node.dataset.skill === component.key);
  else if (component.type === 'dndAbility') target = [...root.querySelectorAll('[data-ability]')].find((node) => node.dataset.ability === component.key);
  else if (component.type === 'dndDerived') target = document.getElementById(derivedIds[component.stat]);
  else if (collectionIds[component.field]) {
    const collection = document.getElementById(collectionIds[component.field]);
    if (component.field === 'inventory.items') {
      const filter = document.getElementById('inventory-search');
      if (filter.value) { filter.value = ''; filter.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    const item = getByPath(character, component.field)?.[entry.itemIndex];
    target = item?.id ? [...collection.querySelectorAll('[data-id]')].find((node) => node.dataset.id === item.id) : collection.children[entry.itemIndex];
    target ||= collection;
    if (target.matches('details')) target.open = true;
    if (entry.itemField) target = [...target.querySelectorAll('[data-field]')].find((node) => node.dataset.field === entry.itemField)?.closest('label, td') || target;
  } else if (tagIds[component.field]) target = document.getElementById(tagIds[component.field]);
  else target = [...root.querySelectorAll('[data-bind]')].find((node) => node.dataset.bind === component.field)?.closest('label, .vital-stat') || null;
  highlightSearchTarget(target || document.getElementById(`panel-${entry.tabId}`));
}
