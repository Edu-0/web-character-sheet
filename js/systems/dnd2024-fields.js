import { createCalculationControl } from '../engine/calculation-overrides.js';
// Componentes de apresentação específicos de D&D. O renderizador permanece agnóstico.
import { registerFieldType } from '../engine/fields.js';
import { getByPath, setByPath } from '../engine/paths.js';
import {
  abilityModifier, dndCalculation, carryCapacity, formatModifier, initiativeModifier,
  passivePerception, proficiencyBonus, savingThrowModifier, skillModifier,
  spellAttackBonus, spellSaveDC, totalInventoryWeight,
} from '../calculations.js';
import { roll } from '../dice.js';

function node(tag, className, label) {
  const element = document.createElement(tag);
  element.className = className;
  if (label) element.textContent = label;
  return element;
}

function rollCheck(label, modifier) {
  const result = roll({ sides: 20, count: 1, modifier, label });
  document.dispatchEvent(new CustomEvent('dnd:rolled', { detail: result }));
}

registerFieldType('dndAbility', {
  print({ character, field, key, label }) {
    const score = getByPath(character, field) ?? 10;
    return printStat(label, `${score} · ${formatModifier(abilityModifier(score, character, key))}`, `Resistência ${formatModifier(savingThrowModifier(character, key))} · ${getByPath(character, `savingThrows.${key}.proficient`) ? 'Proficiente' : 'Sem proficiência'}`);
  },
  search({ character, field, key, label, short }) {
    const score = getByPath(character, field) ?? 10;
    return [
      { label, value: `${score} · modificador ${formatModifier(abilityModifier(score, character, key))}`, keywords: [short || ''] },
      { label: `Resistência de ${label}`, value: formatModifier(savingThrowModifier(character, key)) },
    ];
  },
  render(container, context) {
    const { character, field, key, label, short, onChange } = context;
    const card = node('div', 'engine-dnd-ability');
    const heading = node('strong', 'engine-dnd-ability__name', short || label);
    heading.title = label;
    const score = node('input', 'engine-dnd-ability__score');
    score.type = 'number';
    score.setAttribute('aria-label', `Valor de ${label}`);
    score.value = getByPath(character, field) ?? 10;
    const modifier = node('button', 'engine-dnd-ability__modifier');
    modifier.type = 'button';
    modifier.setAttribute('aria-label', `Rolar teste de ${label}`);
    const save = node('label', 'engine-dnd-ability__save');
    const saveInput = document.createElement('input');
    saveInput.type = 'checkbox';
    saveInput.checked = Boolean(getByPath(character, `savingThrows.${key}.proficient`));
    const saveRoll = node('button', 'engine-dnd-ability__save-roll');
    saveRoll.type = 'button';
    saveRoll.setAttribute('aria-label', `Rolar resistência de ${label}`);
    const refresh = () => {
      modifier.textContent = formatModifier(abilityModifier(getByPath(character, field), character, key));
      saveRoll.textContent = formatModifier(savingThrowModifier(character, key));
    };
    score.addEventListener('input', () => {
      setByPath(character, field, Number(score.value) || 0);
      onChange?.();
    });
    saveInput.addEventListener('change', () => {
      setByPath(character, `savingThrows.${key}.proficient`, saveInput.checked);
      onChange?.();
    });
    modifier.addEventListener('click', () => rollCheck(label, abilityModifier(getByPath(character, field), character, key)));
    saveRoll.addEventListener('click', () => rollCheck(`Resistência de ${label}`, savingThrowModifier(character, key)));
    save.append(saveInput, node('span', '', 'Resistência'));
    card.append(heading, score, modifier, save, saveRoll);
    card.append(overrideControl(context, `ability.${key}`, `Modificador de ${label}`), overrideControl(context, `save.${key}`, `Resistência de ${label}`));
    context.registerRefresh?.(refresh);
    refresh();
    container.appendChild(card);
  },
});

registerFieldType('dndSkill', {
  print({ character, key, label }) {
    const skill = character.skills[key];
    return printStat(label, formatModifier(skillModifier(character, key)), skill?.expertise ? 'Especialização' : skill?.proficient ? 'Proficiente' : 'Sem proficiência');
  },
  search({ character, key, label }) {
    return [{ label, value: formatModifier(skillModifier(character, key)) }];
  },
  render(container, context) {
    const { character, field, key, label, ability, onChange } = context;
    const row = node('div', 'engine-dnd-skill');
    const proficiency = node('label', 'engine-dnd-skill__check');
    const proficiencyInput = document.createElement('input');
    proficiencyInput.type = 'checkbox';
    proficiencyInput.checked = Boolean(getByPath(character, field));
    proficiencyInput.setAttribute('aria-label', `Proficiência em ${label}`);
    proficiency.append(proficiencyInput, node('span', 'visually-hidden', 'Proficiência'));
    const expertise = node('label', 'engine-dnd-skill__check');
    const expertiseInput = document.createElement('input');
    expertiseInput.type = 'checkbox';
    expertiseInput.checked = Boolean(getByPath(character, `skills.${key}.expertise`));
    expertiseInput.setAttribute('aria-label', `Especialização em ${label}`);
    expertise.append(expertiseInput, node('span', 'visually-hidden', 'Especialização'));
    const name = node('span', 'engine-dnd-skill__name', label);
    const abilityLabel = node('small', 'engine-dnd-skill__ability', ability.toUpperCase());
    const modifier = node('button', 'engine-dnd-skill__modifier');
    modifier.type = 'button';
    modifier.setAttribute('aria-label', `Rolar ${label}`);
    const refresh = () => { modifier.textContent = formatModifier(skillModifier(character, key)); };
    proficiencyInput.addEventListener('change', () => {
      setByPath(character, field, proficiencyInput.checked);
      if (!proficiencyInput.checked) {
        expertiseInput.checked = false;
        setByPath(character, `skills.${key}.expertise`, false);
      }
      onChange?.();
    });
    expertiseInput.addEventListener('change', () => {
      setByPath(character, `skills.${key}.expertise`, expertiseInput.checked);
      if (expertiseInput.checked) {
        proficiencyInput.checked = true;
        setByPath(character, field, true);
      }
      onChange?.();
    });
    modifier.addEventListener('click', () => rollCheck(label, skillModifier(character, key)));
    row.append(proficiency, expertise, name, abilityLabel, modifier);
    row.append(overrideControl(context, `skill.${key}`, label));
    context.registerRefresh?.(refresh);
    refresh();
    container.appendChild(row);
  },
});

const derivedValues = {
  proficiency: (character) => formatModifier(proficiencyBonus(character.identity.level, character)),
  initiative: (character) => formatModifier(initiativeModifier(character)),
  passivePerception: (character) => passivePerception(character),
  spellSaveDC: (character) => spellSaveDC(character) ?? '—',
  spellAttackBonus: (character) => {
    const value = spellAttackBonus(character);
    return value === null ? '—' : formatModifier(value);
  },
  totalInventoryWeight: (character) => totalInventoryWeight(character).toFixed(1),
  carryCapacity: (character) => carryCapacity(character).toFixed(1),
};

registerFieldType('dndDerived', {
  print(context) {
    return printStat(context.label, derivedValues[context.stat]?.(context.character) ?? '—');
  },
  search(context) {
    return [{ label: context.label, value: derivedValues[context.stat]?.(context.character) ?? '—' }];
  },
  render(container, context) {
    const card = node('div', 'engine-dnd-derived');
    const label = node('span', 'engine-dnd-derived__label', context.label);
    const output = node('output', 'engine-dnd-derived__value');
    const refresh = () => { output.textContent = String(derivedValues[context.stat]?.(context.character) ?? '—'); };
    card.append(label, output, overrideControl(context, context.stat, context.label));
    context.registerRefresh?.(refresh);
    refresh();
    container.appendChild(card);
  },
});

function printStat(label, value, detail) {
  const wrap = node('div', 'print-field');
  wrap.append(node('span', 'print-label', label), node('strong', '', String(value)));
  if (detail) wrap.append(node('div', 'print-detail', detail));
  return wrap;
}

function overrideControl(context, id, label) {
  return createCalculationControl({ ...context, key: `dnd.${id}`, label,
    automatic: () => dndCalculation(context.character, id, true) });
}
