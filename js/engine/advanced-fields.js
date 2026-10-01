import { registerFieldType } from './fields.js';
import { getByPath, setByPath } from './paths.js';
import { evaluate } from './formula.js';
import { rollOne, resolve } from './dice-resolver.js';
import { potencyOptions, resolvePool, rollPool } from './pool.js';
import { resolveAction } from './resolution.js';
import { stepUp } from './die-scale.js';
import { applyEffectToGradedState } from './graded-state.js';

registerFieldType('tagList', {
  render(container, context) {
    renderTagList(container, context);
  },
});

registerFieldType('list', {
  render(container, context) {
    renderList(container, context);
  },
});

registerFieldType('stateList', {
  render(container, context) {
    renderList(container, { ...context, variant: context.variant || 'state' });
  },
});

registerFieldType('table', {
  render(container, context) {
    renderTable(container, context);
  },
});

registerFieldType('computed', {
  render(container, context) {
    const wrap = fieldBlock(context.label, 'engine-computed');
    const output = element('output', 'engine-computed__value');
    const refresh = () => {
      try {
        const variables = resolveFormulaVariables(context.variables, context.character, context.system, false);
        output.value = formatValue(evaluate(context.system.formulas[context.formula], { vars: variables, data: context.character }), context.format);
        output.textContent = output.value;
      } catch (error) {
        output.value = '—';
        output.textContent = '—';
        output.title = error.message;
      }
    };

    if (context.mode === 'roll') {
      output.value = '—';
      output.textContent = '—';
      const button = buttonElement(context.actionLabel || 'Rolar', 'button button--ghost');
      button.addEventListener('click', () => {
        const variables = resolveFormulaVariables(context.variables, context.character, context.system, true);
        const value = evaluate(context.system.formulas[context.formula], { vars: variables, data: context.character });
        output.value = formatValue(value, context.format);
        output.textContent = output.value;
      });
      wrap.append(output, button);
    } else {
      refresh();
      context.registerRefresh?.(refresh);
      wrap.appendChild(output);
    }
    container.appendChild(wrap);
  },
});

registerFieldType('slotTracker', {
  render(container, context) {
    const wrap = fieldBlock(context.label, 'engine-slots');
    const list = element('div', 'engine-slots__grid');
    const slots = ensureArray(context.character, context.field);
    slots.forEach((slot) => {
      const row = element('div', 'engine-slot');
      const label = element('strong', 'engine-slot__label', context.levelLabel?.replace('{level}', slot.level) || `Nível ${slot.level}`);
      const decrement = buttonElement('−', 'engine-counter__button');
      decrement.setAttribute('aria-label', `Reduzir usos do nível ${slot.level}`);
      const count = element('span', 'engine-slot__count');
      const increment = buttonElement('+', 'engine-counter__button');
      increment.setAttribute('aria-label', `Aumentar usos do nível ${slot.level}`);
      const maximum = document.createElement('input');
      maximum.type = 'number';
      maximum.min = '0';
      maximum.setAttribute('aria-label', `Máximo do nível ${slot.level}`);
      maximum.value = slot.max ?? 0;
      const refresh = () => { count.textContent = `${slot.used ?? 0} / ${slot.max ?? 0}`; };
      decrement.addEventListener('click', () => {
        slot.used = Math.max(0, Number(slot.used || 0) - 1);
        refresh();
        context.onChange?.();
      });
      increment.addEventListener('click', () => {
        slot.used = Math.min(Number(slot.max || 0), Number(slot.used || 0) + 1);
        refresh();
        context.onChange?.();
      });
      maximum.addEventListener('input', () => {
        slot.max = Math.max(0, numberValue(maximum));
        slot.used = Math.min(slot.used || 0, slot.max);
        refresh();
        context.onChange?.();
      });
      refresh();
      row.append(label, decrement, count, increment, maximum);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    container.appendChild(wrap);
  },
});

registerFieldType('poolBuilder', {
  render(container, context) {
    renderPoolBuilder(container, context);
  },
});

registerFieldType('image', {
  render(container, context) {
    const wrap = fieldBlock(context.label, 'engine-image');
    const preview = document.createElement('img');
    preview.className = 'engine-image__preview';
    preview.alt = context.alt || context.label || 'Imagem do personagem';
    const controls = element('div', 'engine-image__controls');
    const upload = buttonElement('Escolher imagem', 'button button--ghost');
    const remove = buttonElement('Remover', 'button button--ghost');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'visually-hidden';
    const refresh = () => {
      const source = getByPath(context.character, context.field);
      preview.hidden = !source;
      remove.hidden = !source;
      if (source) preview.src = source;
    };
    upload.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const [file] = input.files;
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setByPath(context.character, context.field, reader.result);
        refresh();
        context.onChange?.();
      });
      reader.readAsDataURL(file);
    });
    remove.addEventListener('click', () => {
      setByPath(context.character, context.field, null);
      refresh();
      context.onChange?.();
    });
    controls.append(upload, remove, input);
    wrap.append(preview, controls);
    refresh();
    container.appendChild(wrap);
  },
});

function renderTagList(container, context) {
  const wrap = fieldBlock(context.label, 'engine-tags');
  const chips = element('div', 'engine-tags__chips');
  const inputRow = element('div', 'engine-tags__input');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = context.placeholder || 'Adicionar…';
  const add = buttonElement('Adicionar', 'button button--ghost');
  const values = ensureArray(context.character, context.field);

  const refresh = () => {
    chips.innerHTML = '';
    values.forEach((value, index) => {
      const chip = element('span', 'tag-chip');
      chip.appendChild(element('span', '', String(value)));
      const remove = buttonElement('×', 'tag-chip__remove');
      remove.setAttribute('aria-label', `Remover ${value}`);
      remove.addEventListener('click', () => {
        values.splice(index, 1);
        refresh();
        context.onChange?.();
      });
      chip.appendChild(remove);
      chips.appendChild(chip);
    });
    chips.toggleAttribute('hidden', values.length === 0);
  };
  const addValue = () => {
    const value = input.value.trim();
    if (!value || values.includes(value)) return;
    values.push(value);
    input.value = '';
    refresh();
    context.onChange?.();
  };
  add.addEventListener('click', addValue);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addValue();
    }
  });
  inputRow.append(input, add);
  wrap.append(chips, inputRow);
  refresh();
  container.appendChild(wrap);
}

function renderList(container, context) {
  const wrap = fieldBlock(context.label, `engine-collection engine-collection--${context.variant || 'cards'}`);
  const toolbar = element('div', 'engine-collection__toolbar');
  const count = element('span', 'engine-collection__count');
  const add = buttonElement(context.addLabel || 'Adicionar', 'button button--primary');
  const entries = element('div', 'engine-entry-list');
  const values = ensureArray(context.character, context.field);
  toolbar.append(count, add);

  const refresh = () => {
    entries.innerHTML = '';
    count.textContent = `${values.length} ${values.length === 1 ? 'item' : 'itens'}`;
    add.hidden = Number.isInteger(context.fixedLength) && values.length >= context.fixedLength;
    if (!values.length) entries.appendChild(element('p', 'engine-empty', context.emptyLabel || 'Nenhum item cadastrado.'));
    values.forEach((item, index) => entries.appendChild(renderEntry(item, index, values, context, refresh)));
  };
  add.addEventListener('click', () => {
    if (Number.isInteger(context.fixedLength) && values.length >= context.fixedLength) return;
    values.push({ id: createId(), ...defaultsFromSchema(context.itemSchema, context) });
    refresh();
    context.onChange?.();
  });
  wrap.append(toolbar, entries);
  refresh();
  container.appendChild(wrap);
}

function renderEntry(item, index, values, context, refreshList) {
  const entry = document.createElement('details');
  entry.className = 'engine-entry';
  entry.open = values.length <= 3;
  const summary = document.createElement('summary');
  summary.className = 'engine-entry__summary';
  const title = element('strong', 'engine-entry__title', entryTitle(item, index));
  const meta = element('span', 'engine-entry__meta', entryMeta(item));
  summary.append(title, meta);
  if (!Number.isInteger(context.fixedLength) || values.length > context.fixedLength) {
    const remove = buttonElement('Remover', 'button button--ghost engine-entry__remove');
    remove.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      values.splice(index, 1);
      refreshList();
      context.onChange?.();
    });
    summary.appendChild(remove);
  }
  const body = element('div', 'engine-entry__body');
  Object.entries(context.itemSchema || {}).forEach(([key, definition]) => {
    body.appendChild(renderItemField(item, key, definition, context, () => {
      title.textContent = entryTitle(item, index);
      meta.textContent = entryMeta(item);
      context.onChange?.();
    }));
  });
  if (context.type === 'stateList') body.appendChild(renderStateEffect(item, context, () => {
    const gradeField = context.gradeField || 'sides';
    const gradeControl = [...body.querySelectorAll('.engine-item-field')]
      .find((field) => field.dataset.itemField === gradeField)?.querySelector('select');
    if (gradeControl) gradeControl.value = String(item[gradeField] ?? '');
    meta.textContent = entryMeta(item);
    context.onChange?.();
  }));
  entry.append(summary, body);
  return entry;
}

function renderStateEffect(item, context, onChange) {
  const gradeField = context.gradeField || 'sides';
  const wrap = fieldBlock(context.effectLabel || 'Aplicar efeito', 'engine-state-effect');
  const controls = element('div', 'engine-state-effect__controls');
  const selector = document.createElement('select');
  selector.setAttribute('aria-label', 'Dado do efeito');
  (context.dieScale || []).forEach((sides) => selector.appendChild(optionElement(sides, `d${sides}`)));
  const apply = buttonElement('Aplicar efeito', 'button button--ghost');
  const feedback = element('span', 'engine-state-effect__feedback');
  apply.addEventListener('click', () => {
    const result = applyEffectToGradedState(item[gradeField], Number(selector.value));
    item[gradeField] = result.sides;
    const labels = {
      created: `Estado criado em d${result.sides}.`,
      raised: `Estado elevado para d${result.sides}.`,
      upgraded: result.ascension ? `Estado em d${result.sides}: 1 Ascensão.` : `Estado aprimorado para d${result.sides}.`,
      unchanged: `O efeito não altera o Estado d${result.sides}.`,
    };
    feedback.textContent = labels[result.mode];
    if (result.changed) onChange();
  });
  controls.append(selector, apply);
  wrap.append(controls, feedback);
  return wrap;
}

function renderTable(container, context) {
  const wrap = fieldBlock(context.label, 'engine-table');
  const toolbar = element('div', 'engine-collection__toolbar');
  const count = element('span', 'engine-collection__count');
  const add = buttonElement(context.addLabel || 'Adicionar item', 'button button--primary');
  toolbar.append(count, add);
  const scroll = element('div', 'engine-table__scroll');
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const schema = Object.entries(context.itemSchema || {});
  schema.forEach(([key, definition]) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = normalizeDefinition(key, definition).label;
    headRow.appendChild(cell);
  });
  const actionHead = document.createElement('th');
  actionHead.scope = 'col';
  actionHead.appendChild(element('span', 'visually-hidden', 'Ações'));
  headRow.appendChild(actionHead);
  head.appendChild(headRow);
  const body = document.createElement('tbody');
  table.append(head, body);
  scroll.appendChild(table);
  const values = ensureArray(context.character, context.field);

  const refresh = () => {
    body.innerHTML = '';
    count.textContent = `${values.length} ${values.length === 1 ? 'item' : 'itens'}`;
    values.forEach((item, index) => {
      const row = document.createElement('tr');
      schema.forEach(([key, definition]) => {
        const config = normalizeDefinition(key, definition);
        const cell = document.createElement('td');
        cell.dataset.label = config.label;
        cell.appendChild(renderItemField(item, key, definition, context, () => context.onChange?.(), { hideLabel: true }));
        row.appendChild(cell);
      });
      const actionCell = document.createElement('td');
      actionCell.dataset.label = 'Ações';
      const remove = buttonElement('Remover', 'button button--ghost');
      remove.addEventListener('click', () => {
        values.splice(index, 1);
        refresh();
        context.onChange?.();
      });
      actionCell.appendChild(remove);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
  };
  add.addEventListener('click', () => {
    values.push({ id: createId(), ...defaultsFromSchema(context.itemSchema, context) });
    refresh();
    context.onChange?.();
  });
  wrap.append(toolbar, scroll);
  refresh();
  container.appendChild(wrap);
}

function renderItemField(item, key, definition, context, onChange, { hideLabel = false } = {}) {
  const config = normalizeDefinition(key, definition);
  const wrap = element('label', hideLabel ? 'engine-item-field engine-item-field--compact' : 'field engine-item-field');
  wrap.dataset.itemField = key;
  if (!hideLabel) wrap.appendChild(element('span', '', config.label));
  let control;
  if (config.type === 'textarea') {
    control = document.createElement('textarea');
    control.rows = config.rows || 3;
  } else if (config.type === 'select' || config.type === 'die') {
    control = document.createElement('select');
    const fillOptions = () => {
      const selected = control.value || String(item[key] ?? '');
      control.innerHTML = '';
      const options = config.type === 'die'
        ? [{ value: '', label: '—' }, ...(context.dieScale || []).map((sides) => ({ value: sides, label: `d${sides}` }))]
        : resolveItemOptions(config, context);
      options.forEach((option) => {
        const node = document.createElement('option');
        node.value = option.value ?? option;
        node.textContent = option.label ?? option;
        control.appendChild(node);
      });
      control.value = selected;
    };
    fillOptions();
    if (config.optionsFrom) control.addEventListener('focus', fillOptions);
  } else {
    control = document.createElement('input');
    control.type = config.type === 'boolean' ? 'checkbox' : config.type === 'number' ? 'number' : 'text';
  }

  if (config.type === 'boolean') control.checked = Boolean(item[key]);
  else control.value = item[key] ?? '';
  control.setAttribute('aria-label', config.label);
  const eventName = config.type === 'boolean' || config.type === 'select' || config.type === 'die' ? 'change' : 'input';
  control.addEventListener(eventName, () => {
    if (config.type === 'boolean') item[key] = control.checked;
    else if (config.type === 'number') item[key] = numberValue(control);
    else if (config.type === 'die') item[key] = control.value === '' ? null : Number(control.value);
    else if (config.type === 'reference' && config.multiple) {
      item[key] = control.value.split(',').map((value) => value.trim()).filter(Boolean);
    }
    else item[key] = control.value;
    onChange();
  });
  wrap.appendChild(control);
  return wrap;
}

function renderPoolBuilder(container, context) {
  const wrap = fieldBlock(context.label, 'engine-pool');
  const checklist = element('div', 'engine-pool__traits');
  const refreshTraits = () => {
    const selected = new Set([...checklist.querySelectorAll('input:checked')].map((input) => input.value));
    checklist.innerHTML = '';
    const traits = collectTraits(context.traitSources || [], context.character, context.system);
    traits.forEach((trait) => {
      const label = element('label', 'engine-pool__trait');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = trait.source;
      input.checked = selected.has(trait.source);
      label.append(input, element('span', '', trait.label), element('strong', '', `d${trait.sides}`));
      checklist.appendChild(label);
    });
    if (!traits.length) checklist.appendChild(element('p', 'engine-empty', 'Nenhum Traço disponível para a Pool.'));
  };
  refreshTraits();
  context.registerRefresh?.(refreshTraits);

  const actions = element('div', 'engine-pool__actions');
  const rollButton = buttonElement(context.rollLabel || 'Rolar Pool', 'button button--primary');
  const result = element('div', 'engine-pool__result');
  const potency = document.createElement('select');
  potency.setAttribute('aria-label', 'Potência');
  let actorPool = null;
  rollButton.addEventListener('click', () => {
    const currentTraits = new Map(
      collectTraits(context.traitSources || [], context.character, context.system).map((trait) => [trait.source, trait]),
    );
    const selected = [...checklist.querySelectorAll('input:checked')]
      .map((input) => currentTraits.get(input.value))
      .filter(Boolean);
    actorPool = selected.length ? rollPool(selected) : resolvePool([]);
    renderActorPoolResult(result, actorPool, potency, context.system);
  });
  actions.appendChild(rollButton);

  const opposition = element('div', 'engine-pool__opposition');
  const presetLabel = fieldLabel('Oposição');
  const preset = document.createElement('select');
  preset.appendChild(optionElement('', 'Usar Peso manual'));
  (context.system.opposition?.passivePresets || []).forEach((item) => {
    preset.appendChild(optionElement(item.id, `${item.label} (${item.dice.map((sides) => `d${sides}`).join(' + ')})`));
  });
  presetLabel.appendChild(preset);
  const manualLabel = fieldLabel('Peso manual');
  const manual = document.createElement('input');
  manual.type = 'number';
  manualLabel.appendChild(manual);
  const resolveButton = buttonElement(context.resolveLabel || 'Resolver ação', 'button button--primary');
  const resolution = element('div', 'engine-pool__resolution');
  resolveButton.addEventListener('click', () => {
    renderResolution(resolution, actorPool, preset.value, manual.value, potency.value, context.system);
  });
  opposition.append(presetLabel, manualLabel, resolveButton);
  wrap.append(checklist, actions, result, opposition, resolution);
  container.appendChild(wrap);
}

function renderActorPoolResult(container, pool, potency, system) {
  container.innerHTML = '';
  potency.innerHTML = '';
  if (pool.emptyPool) {
    container.appendChild(element('p', 'engine-callout engine-callout--danger', 'Pool vazia: falha automática.'));
    return;
  }
  const rolls = element('div', 'engine-pool__rolls');
  pool.rolls.forEach((roll) => {
    const item = element('span', 'engine-roll');
    item.append(
      element('span', '', roll.label),
      element('strong', '', `${roll.result}`),
      element('small', '', pool.apex === roll ? 'Ápice' : pool.base === roll ? 'Base' : `d${roll.sides}`),
    );
    rolls.appendChild(item);
  });
  const summary = element('p', 'engine-pool__summary');
  summary.append('Peso ', element('strong', '', String(pool.weight)));
  const potencyLabel = fieldLabel('Potência');
  potencyOptions(pool, system.dieScale?.[0] || 4).forEach((item) => {
    potency.appendChild(optionElement(item.sides, `d${item.sides}${item.forced ? ' (mínima)' : ''}`));
  });
  potencyLabel.appendChild(potency);
  container.append(rolls, summary, potencyLabel);
}

function renderResolution(container, actorPool, presetId, manualValue, potencyValue, system) {
  container.innerHTML = '';
  if (!actorPool || actorPool.emptyPool) {
    container.appendChild(element('p', 'engine-callout engine-callout--danger', 'Role uma Pool válida primeiro.'));
    return;
  }
  let opponentWeight;
  let detail;
  if (manualValue !== '') {
    opponentWeight = Number(manualValue);
    detail = `Peso manual: ${opponentWeight}`;
  } else {
    const selected = system.opposition?.passivePresets?.find((item) => item.id === presetId);
    if (!selected) {
      container.appendChild(element('p', 'engine-callout', 'Escolha uma oposição ou informe o Peso manual.'));
      return;
    }
    const rolled = resolve({ type: 'dicePool', dice: selected.dice.map((sides) => ({ sides })) });
    const opponentPool = resolvePool(rolled.rolls.map((roll) => ({ ...roll, source: selected.id, label: selected.label })));
    opponentWeight = opponentPool.weight;
    detail = `${selected.label}: ${rolled.rolls.map((roll) => roll.result).join(' + ')} = Peso ${opponentWeight}`;
  }
  const outcome = resolveAction(actorPool.weight, opponentWeight);
  const outcomeLabels = {
    criticalSuccess: 'Sucesso crítico',
    criticalFailure: 'Falha crítica',
    success: 'Sucesso',
    failure: 'Falha',
  };
  container.append(
    element('p', '', detail),
    element('p', '', `Dificuldade ${outcome.difficulty}${outcome.rolled ? ` · d20 ${outcome.d20}` : ' · resultado automático'}`),
    element('strong', `engine-outcome engine-outcome--${outcome.success ? 'success' : 'failure'}`, outcomeLabels[outcome.outcome]),
  );
  if (outcome.outcome === 'criticalSuccess' && potencyValue) {
    const improved = stepUp(Number(potencyValue));
    const detailText = improved.overflow
      ? `Potência Excepcional: d${potencyValue} + 1 Ascensão.`
      : `Potência aprimorada: d${potencyValue} → d${improved.sides}.`;
    container.appendChild(element('p', 'engine-callout', detailText));
  }
}

function collectTraits(sources, character, system) {
  return sources.flatMap((source) => {
    if (source.kind === 'field') {
      const sides = getByPath(character, source.field);
      return sides ? [{ source: source.id || source.field, label: source.label, sides }] : [];
    }
    if (source.kind === 'entries') {
      const entries = getByPath(character, source.field) || {};
      return Object.entries(entries).flatMap(([key, sides]) => sides ? [{
        source: interpolate(source.id || key, { key, name: key }),
        label: interpolate(source.label || key, { key, name: key }),
        sides,
      }] : []);
    }
    const collection = source.from === 'system' ? getByPath(system, source.collection) : getByPath(character, source.collection);
    if (!Array.isArray(collection)) return [];
    return collection.flatMap((item) => {
      if (source.require && !getByPath(item, source.require)) return [];
      const context = item && typeof item === 'object' ? item : { value: item, key: item, name: item, label: item };
      const sidesPath = interpolate(source.sides, context);
      const sides = source.from === 'system' ? getByPath(character, sidesPath) : getByPath(item, sidesPath);
      if (!sides) return [];
      return [{
        source: interpolate(source.id || sidesPath, context),
        label: interpolate(source.label, context),
        sides,
      }];
    });
  });
}

function resolveFormulaVariables(definitions = {}, character, system, roll) {
  return Object.fromEntries(Object.entries(definitions).map(([key, definition]) => {
    if (definition.field) return [key, getByPath(character, definition.field) ?? 0];
    if (definition.system) return [key, getByPath(system, definition.system) ?? 0];
    if (definition.rollField) {
      const sides = getByPath(character, definition.rollField);
      return [key, roll && sides ? rollOne(sides) : 0];
    }
    return [key, definition.value ?? 0];
  }));
}

function resolveItemOptions(config, context) {
  if (Array.isArray(config.options)) return [{ value: '', label: '—' }, ...config.options.map((item) => normalizeOption(item))];
  if (!config.optionsFrom) return [{ value: '', label: '—' }];
  const [scope, ...path] = config.optionsFrom.split('.');
  const root = scope === 'character' ? context.character : context.system;
  const values = getByPath(root, path.join('.')) || [];
  return [{ value: '', label: '—' }, ...values.map((item, index) => normalizeOption(item, config, index))];
}

function normalizeOption(item, config = {}, index = 0) {
  if (item == null || typeof item !== 'object') return { value: item, label: String(item ?? '') };
  return {
    value: getByPath(item, config.valueField || 'id') ?? item.value ?? index,
    label: getByPath(item, config.labelField || 'name') ?? item.label ?? item.id ?? String(index + 1),
  };
}

function defaultsFromSchema(schema = {}, context) {
  return Object.fromEntries(Object.entries(schema).map(([key, definition]) => {
    const config = normalizeDefinition(key, definition);
    if (config.default !== undefined) return [key, structuredClone(config.default)];
    if (config.type === 'boolean') return [key, false];
    if (config.type === 'number') return [key, 0];
    if (config.type === 'die') return [key, context.dieScale?.[0] ?? null];
    if (config.type === 'reference' && config.multiple) return [key, []];
    return [key, ''];
  }));
}

function normalizeDefinition(key, definition) {
  const config = typeof definition === 'string' ? { type: definition } : definition;
  return { label: humanize(key), ...config };
}

function entryTitle(item, index) {
  return item.name?.trim() || item.label?.trim() || `Item ${index + 1}`;
}

function entryMeta(item) {
  const parts = [];
  const sides = item.die ?? item.sides ?? item.currentDie;
  if (sides) parts.push(`d${sides}`);
  if (item.type) parts.push(item.type);
  if (item.usage) parts.push(item.usage);
  return parts.join(' · ');
}

function ensureArray(character, field) {
  let value = getByPath(character, field);
  if (!Array.isArray(value)) {
    value = [];
    setByPath(character, field, value);
  }
  return value;
}

function fieldBlock(label, className) {
  const wrap = element('div', className);
  if (label) wrap.appendChild(element('h3', `${className.split(' ')[0]}__label`, label));
  return wrap;
}

function fieldLabel(label) {
  const wrap = element('label', 'field');
  wrap.appendChild(element('span', '', label));
  return wrap;
}

function optionElement(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function buttonElement(label, className) {
  const button = element('button', className, label);
  button.type = 'button';
  return button;
}

function numberValue(input) {
  return input.value === '' ? 0 : Number(input.value);
}

function formatValue(value, format) {
  if (!Number.isFinite(value)) return String(value ?? '—');
  if (format === 'signed') return value >= 0 ? `+${value}` : String(value);
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function humanize(value) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function interpolate(value = '', context) {
  return value.replace(/\{([^}]+)\}/g, (_, key) => context[key] ?? `{${key}}`);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}
