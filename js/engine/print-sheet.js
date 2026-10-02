import { safeImageSource } from '../images.js';
// Documento de leitura independente de abas, filtros e apresentação da tela.
import { getFieldType } from './fields.js';
import { getByPath } from './paths.js';
import { traitDice } from './traits.js';
import { createDiceLabel } from '../dice-display.js';
import { formatFieldValue } from './value-format.js';
import { createOrnament } from '../artwork.js';
import { ORNAMENTS } from '../../assets/artwork/ornaments.js';
import { normalizePrintProfile, printOptions, componentsForPrint } from './print-profile.js';

const node = (tag, className = '', text) => {
  const el = document.createElement(tag);
  el.className = className;
  if (text != null) el.textContent = String(text);
  return el;
};

export function buildPrintSheet(layout, source, system, appearance = {}) {
  const profile = normalizePrintProfile(appearance.printProfile);
  const expand = container => componentsForPrint(container, system, profile);
  // Componentes existentes podem normalizar defaults ao renderizar. A cópia nunca
  // é inscrita no estado, e nenhum callback de edição ou de rolagem é chamado.
  const character = structuredClone(source);
  const collectionSchemas = new Map();
  const printedCollections = new Set();
  let portraitField;
  for (const tab of layout?.tabs || []) for (const section of tab.sections || []) {
    if (printOptions(section, profile).include === false) continue;
    for (const container of section.containers || []) for (const component of expand(container)) {
      if (component.itemSchema && component.field) collectionSchemas.set(component.field, { ...collectionSchemas.get(component.field), ...component.itemSchema });
      if (!portraitField && component.type === 'image' && safeImageSource(getByPath(character, component.field))) portraitField = component.field;
    }
  }
  const document = node('article', 'print-sheet');
  document.dataset.variant = layout?.variant || '';
  document.dataset.printProfile = profile;
  const name = character.identity?.name?.trim() || character.name?.trim() || 'Personagem sem nome';
  const header = node('header', 'print-heading');
  const heading = node('div', 'print-heading__text');
  heading.append(node('p', 'print-heading__system', system.name), node('h1', '', name), node('p', 'print-heading__caption', profile === 'compact' ? 'Ficha de personagem · Compacta — versão de consulta' : 'Ficha de personagem · Completa'));
  header.append(heading);
  if (portraitField) {
    const portrait = node('img', 'print-heading__portrait');
    portrait.src = safeImageSource(getByPath(character, portraitField)); portrait.alt = 'Retrato do personagem';
    header.append(portrait);
  }
  if (appearance.artwork?.enabled && appearance.artwork.selected.length) {
    const art = node('div', 'print-heading__art');
    art.dataset.intensity = appearance.artwork.intensity;
    for (const position of ['left', 'center', 'right']) {
      const slot = node('div'); slot.dataset.position = position;
      const selected = appearance.artwork.selected.find(item => item.position === position);
      const ornament = selected && ORNAMENTS.find(item => item.id === selected.id);
      if (ornament) slot.append(createOrnament(ornament));
      art.append(slot);
    }
    header.append(art);
  }
  document.append(header);
  for (const tab of layout?.tabs || []) {
    const chapter = node('section', 'print-chapter');
    chapter.append(node('h2', '', tab.label));
    for (const section of tab.sections || []) {
      if (printOptions(section, profile).include === false) continue;
      const group = node('section', 'print-section');
      if (printOptions(section, profile).presentation === 'inline') group.classList.add('print-section--inline');
      if (section.title) group.append(node('h3', '', section.title));
      const fields = node('div', 'print-fields');
      for (const container of section.containers || []) {
        const target = printOptions(container, profile).presentation === 'inline' ? node('div', 'print-fields print-fields--inline') : fields;
        for (const component of expand(container)) {
          if (component.type === 'image' && component.field === portraitField) continue;
          if (component.itemSchema && component.field) {
            if (printedCollections.has(component.field)) continue;
            printedCollections.add(component.field);
            component.itemSchema = collectionSchemas.get(component.field);
          }
          const content = printComponent({ ...component, character, system });
          if (content) content.dataset.fieldType = component.type;
          if (content) target.append(content);
        }
        if (target !== fields && target.children.length) fields.append(target);
      }
      if (fields.children.length) { group.append(fields); chapter.append(group); }
    }
    if (chapter.children.length > 1) document.append(chapter);
  }
  return document;
}

function valueNode(value, definition, context) {
  if (definition.type === 'die') return createDiceLabel(traitDice(value));
  return node('span', '', value == null || value === '' ? '—' : formatFieldValue(value, definition, context));
}

function field(label, value, definition, context) {
  const el = node('div', 'print-field');
  el.append(node('span', 'print-label', label), valueNode(value, definition, context));
  if ((definition.type === 'textarea' && value) || String(value ?? '').length > 180) el.classList.add('print-long');
  return el;
}

function printComponent(context) {
  const { type, character, system, label, itemSchema } = context;
  const value = getByPath(character, context.field);
  const custom = getFieldType(type)?.print;
  if (custom) return custom(context);
  if (type === 'poolBuilder' || type === 'traitAllocation') return null;
  if (type === 'computed' && context.mode === 'roll') return field(label, 'Rolagem sob demanda', {}, context);
  if (type === 'image') {
    if (!safeImageSource(value)) return field(label, 'Sem retrato', {}, context);
    const wrap = node('figure', 'print-portrait');
    const img = node('img'); img.src = safeImageSource(value); img.alt = label || 'Retrato';
    wrap.append(img); return wrap;
  }
  if (type === 'skillCatalog') {
    const wrap = node('div', 'print-wide');
    wrap.append(node('h4', '', label));
    const values = value || {};
    const known = new Set();
    for (const category of system[context.categoriesFrom || 'skillCategories'] || []) {
      wrap.append(node('h5', '', category.label || category.id));
      const group = node('div', 'print-fields');
      for (const name of category.skills || []) {
        known.add(name);
        group.append(field(name, values[name] || system[context.baseDieFrom || 'skillBaseDie'] || 4, { type: 'die' }, context));
      }
      wrap.append(group);
    }
    for (const [name, die] of Object.entries(values)) if (!known.has(name)) wrap.append(field(name, die, { type: 'die' }, context));
    return wrap;
  }
  if (itemSchema && Array.isArray(value)) return collection(context, value);
  if (type === 'slotTracker') {
    const wrap = node('div', 'print-wide');
    wrap.append(node('h4', '', label));
    const group = node('div', 'print-fields');
    for (const slot of value || []) group.append(field(`Nível ${slot.level}`, `${slot.used ?? 0} / ${slot.max ?? 0} usados`, {}, context));
    wrap.append(group); return wrap;
  }
  if (type === 'actionGroup') {
    const event = getByPath(character, context.historyField || 'scene.lastAction');
    return event ? field(label || 'Última ação', [event.label, ...(event.details || []), event.note].filter(Boolean).join('\n'), { type: 'textarea' }, context) : null;
  }
  if (type === 'techniqueUse') return techniqueRecords(context);
  // Cálculos determinísticos e seus rótulos continuam pertencendo aos componentes.
  // A renderização auxiliar fica desconectada; só nós sem listeners são inseridos.
  if (['computed', 'dndAbility', 'dndSkill', 'dndDerived', 'inventorySummary', 'repertoire', 'pointBudget'].includes(type)) return calculated(context);
  return field(label || context.heading || context.field || type, value, context, context);
}

function collection(context, items) {
  const wrap = node('div', 'print-wide');
  wrap.append(node('h4', '', context.label || context.heading));
  if (!items.length) { wrap.append(node('p', 'print-empty', 'Nenhum registro.')); return wrap; }
  const schema = Object.entries(context.itemSchema).map(([key, def]) => [key, typeof def === 'string' ? { type: def, label: key } : def]);
  // Tabelas estreitas com linhas curtas podem repetir cabeçalho. Tabelas largas
  // ou células extensas viram registros fluidos, sem fonte minúscula nem corte.
  const tableSafe = (context.printPresentation === 'table' || (context.type === 'table' && context.printPresentation !== 'records')) && schema.length <= 6 && items.every(item => schema.every(([key]) => String(item[key] ?? '').length < 160));
  if (tableSafe) {
    const table = node('table'); const head = node('thead'); const row = node('tr');
    schema.forEach(([key, def]) => row.append(node('th', '', def.label || key)));
    head.append(row); table.append(head); const body = node('tbody');
    items.forEach(item => {
      const tr = node('tr');
      schema.forEach(([key, def]) => { const td = node('td'); td.append(valueNode(item[key], def, context)); tr.append(td); });
      body.append(tr);
    });
    table.append(body); wrap.append(table); return wrap;
  }
  items.forEach((item, index) => {
    const entry = node('section', context.type === 'table' ? 'print-entry print-entry--compact' : 'print-entry');
    if (schema.length <= 15 && schema.reduce((length, [key]) => length + String(item[key] ?? '').length, 0) < 600) entry.classList.add('print-entry--short');
    entry.append(node('h5', '', (schema.some(([key]) => key === 'name') && item.name) || `Registro ${index + 1}`));
    const fields = node('div', 'print-fields');
    schema.forEach(([key, def]) => {
      if (key === 'name') return;
      fields.append(field(def.label || key, item[key], def, context));
    });
    entry.append(fields); wrap.append(entry);
  });
  return wrap;
}

function calculated(context) {
  const host = node('div');
  getFieldType(context.type).render(host, { ...context, dieScale: context.system.dieScale || context.system.diceSet });
  host.querySelectorAll('.engine-budget__evolution, .engine-budget__actions, .engine-budget__feedback, .engine-section__note, small').forEach(el => el.remove());
  host.querySelectorAll('button').forEach(button => {
    // Bônus D&D são também botões na tela: o valor continua, a ação desaparece.
    if (button.matches('.engine-dnd-ability__modifier, .engine-dnd-ability__save-roll, .engine-dnd-skill__modifier')) button.replaceWith(node('strong', '', button.textContent));
    else button.remove();
  });
  host.querySelectorAll('input, select, textarea').forEach(control => {
    const text = control.type === 'checkbox' ? (control.checked ? 'Sim' : 'Não') : control.tagName === 'SELECT' ? control.selectedOptions[0]?.textContent || '—' : control.value || '—';
    control.replaceWith(node('span', '', text));
  });
  host.querySelectorAll('[hidden]').forEach(el => el.remove());
  host.querySelectorAll('.engine-empty').forEach(el => { el.textContent = 'Nenhum registro.'; });
  const result = node('div', ['pointBudget', 'repertoire'].includes(context.type) ? 'print-wide print-calculated' : 'print-field print-calculated');
  // Clone removes event listeners, and attributes/IDs cannot collide with the UI.
  const clone = host.cloneNode(true);
  clone.querySelectorAll('*').forEach(el => {
    const wasLabel = el.matches('.engine-dnd-ability__name, .engine-dnd-derived__label');
    const metric = el.matches('.engine-budget__metric');
    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
    if (wasLabel) el.className = 'print-label';
    if (metric) el.className = 'print-field';
  });
  clone.querySelectorAll('.print-field > span:first-child').forEach(el => { el.className = 'print-label'; });
  result.append(...clone.childNodes);
  if (context.type === 'pointBudget') {
    const config = getByPath(context.system, context.configFrom || 'pointBudget');
    const history = getByPath(context.character, `${config.field}.history`) || [];
    // Além do resumo do componente, preserve data e mudança registradas.
    for (const event of history) if (event.date || event.from != null || event.to != null) {
      result.append(field(event.description, [event.date, event.from != null ? `De ${formatFieldValue(event.from, { type: 'die' })}` : '', event.to != null ? `Para ${formatFieldValue(event.to, { type: 'die' })}` : ''].filter(Boolean).join(' · '), {}, context));
    }
  }
  return result;
}

function techniqueRecords(context) {
  const config = getByPath(context.system, context.configFrom);
  const event = getByPath(context.character, config.lastUseField);
  const concentrations = getByPath(context.character, config.concentrationField) || [];
  if (!event && !concentrations.length) return null;
  const wrap = node('div', 'print-wide');
  const name = id => (getByPath(context.character, config.techniquesField) || []).find(item => item.id === id)?.name || id || 'Técnica não aprendida';
  if (event) {
    const mode = config.modes.find(item => item.id === event.mode)?.label || event.mode;
    wrap.append(field('Último uso registrado', `${name(event.techniqueId)} · ${mode}\nEnergia paga: ${event.energyCost} · d${event.usedDie}\n${event.date || ''}`, { type: 'textarea' }, context));
  }
  for (const item of concentrations) wrap.append(field(`Concentração: ${name(item.techniqueId)}`, item.die, { type: 'die' }, context));
  return wrap;
}
