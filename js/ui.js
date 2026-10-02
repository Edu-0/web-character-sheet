import { createDndRollButton } from './systems/dnd-item-rolls.js';
import { createCalculationControl } from './engine/calculation-overrides.js';
import { safeImageSource } from './images.js';
// ui.js
// Renderização e ligação (binding) da interface com o estado do personagem.
// Não contém fórmulas — apenas exibe valores já calculados por calculations.js.
import { state } from './state.js';
import { CURRENCY_KEYS } from './data.js';
import { getAbilities, getSkills } from './engine/system.js';
import { icons } from './icons.js';
import {
  abilityModifier,
  dndCalculation,
  formatModifier,
  proficiencyBonus,
  savingThrowModifier,
  skillModifier,
  passivePerception,
  initiativeModifier,
  spellSaveDC,
  spellAttackBonus,
  totalInventoryWeight,
  carryCapacity,
} from './calculations.js';


const $ = (id) => document.getElementById(id);

// ---------- Binding genérico de campos simples [data-bind] ----------

export function initGenericBindings() {
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-bind]');
    if (!el) return;
    applyBoundValue(el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-bind]');
    if (!el || el.type === 'text' || el.tagName === 'TEXTAREA') return;
    applyBoundValue(el);
  });
}

function applyBoundValue(el) {
  const path = el.dataset.bind;
  let value;
  if (el.type === 'checkbox') value = el.checked;
  else if (el.type === 'number') value = el.value === '' ? 0 : Number(el.value);
  else value = el.value;
  if (Object.is(state.getPath(path), value)) return;
  state.setPath(path, value);
}

export function syncBoundInputs(character) {
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const value = state.getPath(el.dataset.bind);
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value ?? '';
  });
}

// ---------- Atributos e Perícias ----------

export function buildAbilities(character) {
  const grid = $('abilities-grid');
  const tpl = $('tpl-ability-card');
  grid.innerHTML = '';
  getAbilities().forEach((ability) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.ability = ability.key;
    node.querySelector('[data-el="label"]').textContent = ability.short;
    node.title = ability.label;
    const scoreInput = node.querySelector('[data-el="score"]');
    scoreInput.value = character.abilities[ability.key].score;
    scoreInput.addEventListener('input', () => {
      state.setPath(`abilities.${ability.key}.score`, Number(scoreInput.value) || 0);
    });
    const saveCheckbox = node.querySelector('[data-el="save-proficient"]');
    saveCheckbox.checked = Boolean(character.savingThrows[ability.key]?.proficient);
    saveCheckbox.addEventListener('change', () => {
      state.setPath(`savingThrows.${ability.key}.proficient`, saveCheckbox.checked);
    });
    node.append(staticOverride(character, `ability.${ability.key}`, `Modificador de ${ability.label}`), staticOverride(character, `save.${ability.key}`, `Resistência de ${ability.label}`));
    grid.appendChild(node);
  });
  refreshAbilities(character);
}

export function refreshAbilities(character) {
  const grid = $('abilities-grid');
  getAbilities().forEach((ability) => {
    const node = grid.querySelector(`[data-ability="${ability.key}"]`);
    if (!node) return;
    const score = character.abilities[ability.key].score;
    const mod = abilityModifier(score, character, ability.key);
    node.querySelector('[data-el="score"]').value = score;
    node.querySelector('[data-el="modifier"]').textContent = formatModifier(mod);
    const saveMod = savingThrowModifier(character, ability.key);
    node.querySelector('[data-el="save-modifier"]').textContent = formatModifier(saveMod);
    node.querySelector('[data-el="save-proficient"]').checked = Boolean(character.savingThrows[ability.key]?.proficient);
    node.querySelectorAll('.engine-calculation-control').forEach(control => control.refreshOverride());
  });
}

export function buildSkills(character) {
  const list = $('skills-list');
  const tpl = $('tpl-skill-row');
  list.innerHTML = '';
  getSkills().forEach((skill) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.skill = skill.key;
    node.querySelector('[data-el="name"]').textContent = skill.label;
    node.querySelector('[data-el="ability"]').textContent = skill.ability.toUpperCase();
    const profCb = node.querySelector('[data-el="proficient"]');
    const expCb = node.querySelector('[data-el="expertise"]');
    profCb.addEventListener('change', () => {
      state.setPath(`skills.${skill.key}.proficient`, profCb.checked);
      if (!profCb.checked) state.setPath(`skills.${skill.key}.expertise`, false);
    });
    expCb.addEventListener('change', () => {
      state.setPath(`skills.${skill.key}.expertise`, expCb.checked);
      if (expCb.checked) state.setPath(`skills.${skill.key}.proficient`, true);
    });
    node.append(staticOverride(character, `skill.${skill.key}`, skill.label));
    list.appendChild(node);
  });
  refreshSkills(character);
}

export function refreshSkills(character) {
  const list = $('skills-list');
  getSkills().forEach((skill) => {
    const node = list.querySelector(`[data-skill="${skill.key}"]`);
    if (!node) return;
    const entry = character.skills[skill.key] || {};
    node.querySelector('[data-el="proficient"]').checked = Boolean(entry.proficient);
    node.querySelector('[data-el="expertise"]').checked = Boolean(entry.expertise);
    node.querySelector('[data-el="modifier"]').textContent = formatModifier(skillModifier(character, skill.key));
    node.querySelectorAll('.engine-calculation-control').forEach(control => control.refreshOverride());
  });
}

// ---------- Estatísticas derivadas ----------

export function refreshDerivedStats(character) {
  $('stat-proficiency').textContent = formatModifier(proficiencyBonus(character.identity.level, character));
  $('stat-initiative').textContent = formatModifier(initiativeModifier(character));
  $('stat-passive-perception').textContent = String(passivePerception(character));

  const dc = spellSaveDC(character);
  const atk = spellAttackBonus(character);
  $('stat-spell-dc').textContent = dc === null ? '—' : String(dc);
  $('stat-spell-attack').textContent = atk === null ? '—' : formatModifier(atk);

  $('stat-total-weight').textContent = totalInventoryWeight(character).toFixed(1);
  $('stat-carry-capacity').textContent = carryCapacity(character).toFixed(1);
  for (const [elementId, id, label] of [
    ['stat-proficiency', 'proficiency', 'Proficiência'], ['stat-initiative', 'initiative', 'Iniciativa'],
    ['stat-passive-perception', 'passivePerception', 'Percepção passiva'], ['stat-spell-dc', 'spellSaveDC', 'CD de magia'],
    ['stat-spell-attack', 'spellAttackBonus', 'Ataque mágico'], ['stat-total-weight', 'totalInventoryWeight', 'Peso total'],
    ['stat-carry-capacity', 'carryCapacity', 'Capacidade de carga'],
  ]) {
    const target = $(elementId);
    let control = target.parentElement.querySelector('.engine-calculation-control');
    if (!control || control.overrideCharacter !== character) {
      control?.remove();
      control = staticOverride(character, id, label);
      target.parentElement.append(control);
    }
    control.refreshOverride();
  }
}

// ---------- Ataques ----------

function bindCardFields(node, item, arrayPath, extraOnChange) {
  node.querySelectorAll('[data-field]').forEach((fieldEl) => {
    const field = fieldEl.dataset.field;
    if (fieldEl.type === 'checkbox') fieldEl.checked = Boolean(item[field]);
    else fieldEl.value = item[field] ?? '';

    const handler = () => {
      const value = fieldEl.type === 'checkbox'
        ? fieldEl.checked
        : fieldEl.type === 'number'
          ? (fieldEl.value === '' ? 0 : Number(fieldEl.value))
          : fieldEl.value;
      state.updateItemField(arrayPath, item.id, field, value);
      extraOnChange?.();
    };
    fieldEl.addEventListener(fieldEl.tagName === 'SELECT' || fieldEl.type === 'checkbox' ? 'change' : 'input', handler);
  });
}

export function buildAttacks(character) {
  const list = $('attacks-list');
  const tpl = $('tpl-attack-card');
  list.innerHTML = '';
  character.combat.attacks.forEach((attack) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = attack.id;
    const updateSummary = () => {
      node.querySelector('[data-el="title-display"]').textContent = attack.name || 'Ataque sem nome';
      const meta = [attack.bonus && `Ataque ${attack.bonus}`, attack.damage].filter(Boolean).join(' · ');
      node.querySelector('[data-el="meta-display"]').textContent = meta;
    };
    node.querySelector('.entry-card__body').prepend(createDndRollButton({ item: attack, character, onChange: () => state.notify() }, 'attack'));
    bindCardFields(node, attack, 'combat.attacks', updateSummary);
    updateSummary();
    const removeBtn = node.querySelector('[data-action="remove"]');
    removeBtn.innerHTML = icons.trash;
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.removeItem('combat.attacks', attack.id);
      buildAttacks(state.get());
    });
    list.appendChild(node);
  });
  $('attacks-empty-hint').hidden = character.combat.attacks.length > 0;
}

// ---------- Habilidades / Recursos ----------

export function buildFeatures(character) {
  const list = $('features-list');
  const tpl = $('tpl-feature-card');
  list.innerHTML = '';
  character.features.forEach((feature) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = feature.id;
    const updateSummary = () => {
      node.querySelector('[data-el="title-display"]').textContent = feature.name || 'Habilidade sem nome';
      const usesText = feature.usesMax ? `${feature.usesCurrent ?? 0}/${feature.usesMax} usos` : '';
      node.querySelector('[data-el="meta-display"]').textContent = [feature.source, usesText].filter(Boolean).join(' · ');
    };
    bindCardFields(node, feature, 'features', updateSummary);
    updateSummary();
    node.querySelector('[data-action="remove"]').innerHTML = icons.trash;
    node.querySelector('[data-action="move-up"]').innerHTML = icons.arrowUp;
    node.querySelector('[data-action="move-down"]').innerHTML = icons.arrowDown;
    node.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.removeItem('features', feature.id);
      buildFeatures(state.get());
    });
    node.querySelector('[data-action="move-up"]').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.moveItem('features', feature.id, -1);
      buildFeatures(state.get());
    });
    node.querySelector('[data-action="move-down"]').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.moveItem('features', feature.id, 1);
      buildFeatures(state.get());
    });
    list.appendChild(node);
  });
  $('features-empty-hint').hidden = character.features.length > 0;
}

// ---------- Magias ----------

const SPELL_LEVEL_LABEL = ['Truque', '1º nível', '2º nível', '3º nível', '4º nível', '5º nível', '6º nível', '7º nível', '8º nível', '9º nível'];

export function buildSpells(character) {
  const list = $('spells-list');
  const tpl = $('tpl-spell-card');
  list.innerHTML = '';
  character.spellcasting.spells.forEach((spell) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = spell.id;
    const updateSummary = () => {
      node.querySelector('[data-el="title-display"]').textContent = spell.name || 'Magia sem nome';
      const level = SPELL_LEVEL_LABEL[Number(spell.level) || 0];
      node.querySelector('[data-el="meta-display"]').textContent = [level, spell.school, spell.prepared ? 'Preparada' : null].filter(Boolean).join(' · ');
    };
    node.querySelector('.entry-card__body').prepend(createDndRollButton({ item: spell, character, onChange: () => state.notify() }, 'spell'));
    bindCardFields(node, spell, 'spellcasting.spells', updateSummary);
    updateSummary();
    const removeBtn = node.querySelector('[data-action="remove"]');
    removeBtn.innerHTML = icons.trash;
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.removeItem('spellcasting.spells', spell.id);
      buildSpells(state.get());
    });
    list.appendChild(node);
  });
  $('spells-empty-hint').hidden = character.spellcasting.spells.length > 0;
}

export function buildSpellSlots(character) {
  const container = $('spell-slots');
  const tpl = $('tpl-spell-slot-row');
  container.innerHTML = '';
  character.spellcasting.slots.forEach((slot, index) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-el="label"]').textContent = `Nível ${slot.level}`;
    node.querySelector('[data-action="decrement"]').textContent = '−';
    node.querySelector('[data-action="increment"]').textContent = '+';
    const maxInput = node.querySelector('[data-el="max"]');
    maxInput.value = slot.max;
    const refreshCount = () => {
      node.querySelector('[data-el="count"]').textContent = `${Math.max(0, slot.max - slot.used)} / ${slot.max}`;
      maxInput.value = slot.max;
    };
    maxInput.addEventListener('input', () => {
      const value = Math.max(0, Number(maxInput.value) || 0);
      character.spellcasting.slots[index].max = value;
      if (character.spellcasting.slots[index].used > value) character.spellcasting.slots[index].used = value;
      state.notify();
    });
    node.querySelector('[data-action="decrement"]').addEventListener('click', () => {
      if (slot.used < slot.max) {
        character.spellcasting.slots[index].used += 1;
        state.notify();
      }
    });
    node.querySelector('[data-action="increment"]').addEventListener('click', () => {
      if (slot.used > 0) {
        character.spellcasting.slots[index].used -= 1;
        state.notify();
      }
    });
    refreshCount();
    container.appendChild(node);
  });
}

export function refreshSpellSlots(character) {
  const container = $('spell-slots');
  const rows = container.querySelectorAll('.spell-slot-row');
  character.spellcasting.slots.forEach((slot, index) => {
    const node = rows[index];
    if (!node) return;
    node.querySelector('[data-el="count"]').textContent = `${Math.max(0, slot.max - slot.used)} / ${slot.max}`;
  });
}

// ---------- Inventário ----------

export function buildCurrency(character) {
  const grid = $('currency-grid');
  grid.innerHTML = '';
  CURRENCY_KEYS.forEach(({ key, label }) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'field currency-field';
    wrapper.innerHTML = `<span>${label}</span><input type="number" min="0" data-bind="inventory.currency.${key}" />`;
    grid.appendChild(wrapper);
  });
  syncBoundInputs(character);
}

let inventoryFilter = '';

export function setInventoryFilter(value) {
  inventoryFilter = value.trim().toLowerCase();
  buildInventory(state.get());
}

export function buildInventory(character) {
  const tbody = $('inventory-tbody');
  const tpl = $('tpl-inventory-row');
  tbody.innerHTML = '';
  const items = character.inventory.items.filter((item) =>
    !inventoryFilter || item.name?.toLowerCase().includes(inventoryFilter)
  );
  items.forEach((item) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    bindCardFields(node, item, 'inventory.items', () => refreshDerivedStats(state.get()));
    const removeBtn = node.querySelector('[data-action="remove"]');
    removeBtn.innerHTML = icons.trash;
    removeBtn.addEventListener('click', () => {
      state.removeItem('inventory.items', item.id);
      buildInventory(state.get());
    });
    tbody.appendChild(node);
  });
  $('inventory-empty-hint').hidden = character.inventory.items.length > 0;
  $('inventory-table').hidden = character.inventory.items.length === 0;
}

// ---------- Listas de tags (proficiências / condições) ----------

export function buildTagList(containerId, character, path) {
  const container = $(containerId);
  container.innerHTML = '';

  const chipWrap = document.createElement('div');
  chipWrap.className = 'tag-list__chips';
  const items = state.getPath(path) || [];
  const tpl = $('tpl-tag-chip');
  items.forEach((value, index) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('[data-el="label"]').textContent = value;
    const removeBtn = node.querySelector('[data-action="remove"]');
    removeBtn.innerHTML = icons.close;
    removeBtn.addEventListener('click', () => {
      const list = state.getPath(path);
      list.splice(index, 1);
      state.notify();
      buildTagList(containerId, state.get(), path);
    });
    chipWrap.appendChild(node);
  });

  const inputWrap = document.createElement('div');
  inputWrap.className = 'tag-list__input';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Adicionar e pressionar Enter';
  input.setAttribute('aria-label', 'Adicionar item');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const list = state.getPath(path);
      list.push(input.value.trim());
      state.notify();
      buildTagList(containerId, state.get(), path);
      container.querySelector('.tag-list__input input')?.focus();
    }
  });
  inputWrap.appendChild(input);

  container.appendChild(chipWrap);
  container.appendChild(inputWrap);
}

export function buildAllTagLists(character) {
  buildTagList('tags-armor', character, 'proficiencies.armor');
  buildTagList('tags-weapons', character, 'proficiencies.weapons');
  buildTagList('tags-tools', character, 'proficiencies.tools');
  buildTagList('tags-languages', character, 'proficiencies.languages');
  buildTagList('tags-other', character, 'proficiencies.other');
  buildTagList('conditions-tag-list', character, 'combat.conditions');
}

// ---------- Ícones estáticos (botões que não mudam) ----------

export function mountStaticIcons() {
  $('btn-theme-toggle').innerHTML = icons.sun;
  $('btn-portrait-upload').innerHTML = icons.upload;
  $('btn-portrait-remove').innerHTML = icons.trash;
  $('btn-export').innerHTML = `${icons.download} Exportar JSON`;
  $('btn-import').innerHTML = `${icons.upload} Importar JSON`;
  $('dice-toggle-icon').innerHTML = icons.dice;
  $('portrait-placeholder').innerHTML = icons.image;
}

// ---------- Retrato ----------

export function updatePortrait(character) {
  const img = $('portrait-image');
  const placeholder = $('portrait-placeholder');
  if (safeImageSource(character.identity.portrait)) {
    img.src = safeImageSource(character.identity.portrait);
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    img.removeAttribute('src');
    placeholder.hidden = false;
    placeholder.title = character.identity.portrait ? 'Retrato externo preservado; não carregado automaticamente.' : '';
  }
}

// ---------- Render completo ----------

export function renderAll(character) {
  syncBoundInputs(character);
  buildAbilities(character);
  buildSkills(character);
  buildAttacks(character);
  buildFeatures(character);
  buildSpells(character);
  buildSpellSlots(character);
  buildCurrency(character);
  buildInventory(character);
  buildAllTagLists(character);
  updatePortrait(character);
  refreshDerivedStats(character);
}

export function refreshComputedOnly(character) {
  refreshAbilities(character);
  refreshSkills(character);
  refreshDerivedStats(character);
  refreshSpellSlots(character);
}

function staticOverride(character, id, label) {
  let controlRefresh;
  const control = createCalculationControl({ character, key: `dnd.${id}`, label,
    automatic: () => dndCalculation(character, id, true),
    registerRefresh: refresh => { controlRefresh = refresh; },
    onChange: () => state.setPath('calculationOverrides', structuredClone(character.calculationOverrides || {})),
  });
  control.overrideCharacter = character;
  control.refreshOverride = controlRefresh;
  return control;
}
