import { captureFocus } from '../focus.js';
import { compressPortrait, safeImageSource } from '../images.js';
import { notify } from '../notifications.js';
import { registerFieldType } from './fields.js';
import { getByPath, setByPath } from './paths.js';
import { evaluate } from './formula.js';
import { rollOne, resolve } from './dice-resolver.js';
import { potencyOptions, resolvePool, rollPool } from './pool.js';
import { resolveAction } from './resolution.js';
import { stepUp } from './die-scale.js';
import { applyEffectToGradedState } from './graded-state.js';
import { createTraitControl, parseTrait, traitDescriptor, traitDice, traitLabel, traitMaximum } from './traits.js';
import { healState } from './assistance.js';
import { stepCost } from './point-budget.js';
import { appendFieldHelp } from './help.js';
import { createDiceLabel, createRuleGlyph } from '../dice-display.js';

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

// Catálogo compacto: valores no dado-base são implícitos na ficha, mas continuam
// disponíveis para edição. A configuração (categorias e escala) vem do sistema.
registerFieldType('skillCatalog', {
  search(context) {
    const values = getByPath(context.character, context.field) || {};
    const baseDie = Number(context.system?.[context.baseDieFrom || 'skillBaseDie']) || 4;
    return (context.system?.[context.categoriesFrom || 'skillCategories'] || []).flatMap((category) => (category.skills || []).map((name) => ({
      label: name, value: `${traitLabel(values[name] || baseDie)}${traitMaximum(values[name]) <= baseDie ? ' · dado base' : ''}`, category: category.label || category.id, skillName: name,
    })));
  },
  revealSearchResult(wrapper, entry) {
    let control = [...wrapper.querySelectorAll('select[aria-label]')].find((node) => node.getAttribute('aria-label') === entry.skillName);
    if (!control) {
      const toggle = wrapper.querySelector('.engine-skill-catalog__toolbar button');
      if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
      control = [...wrapper.querySelectorAll('select[aria-label]')].find((node) => node.getAttribute('aria-label') === entry.skillName);
    }
    return control?.closest('.engine-skill-catalog__item') || wrapper;
  },
  render(container, context) {
    const wrap = fieldBlock(context.label, 'engine-skill-catalog');
    const toolbar = element('div', 'engine-skill-catalog__toolbar');
    const count = element('span', 'engine-collection__count');
    const toggle = buttonElement(context.editLabel || 'Editar perícias', 'button button--ghost');
    toggle.setAttribute('aria-expanded', 'false');
    const groups = element('div', 'engine-skill-catalog__groups');
    const baseDie = Number(context.system?.[context.baseDieFrom || 'skillBaseDie']) || 4;
    const categories = context.system?.[context.categoriesFrom || 'skillCategories'] || [];
    const scale = (context.dieScale || []).map(Number).filter((die) => die >= baseDie);
    let editing = false;
    let signature = '';

    const refresh = () => {
      groups.replaceChildren();
      const values = getByPath(context.character, context.field) || {};
      signature = JSON.stringify(values);
      let visibleCount = 0;
      categories.forEach((category) => {
        const entries = (category.skills || []).filter((name) => editing || traitMaximum(values[name]) > baseDie);
        if (!entries.length) return;
        const group = element('section', 'engine-skill-catalog__group');
        group.appendChild(element('h3', 'engine-skill-catalog__heading', category.label || category.id));
        const list = element('div', 'engine-skill-catalog__list');
        entries.forEach((name) => {
          if (traitMaximum(values[name]) > baseDie) visibleCount += 1;
          const row = element('label', 'engine-skill-catalog__item');
          row.appendChild(element('span', 'engine-skill-catalog__name', name));
          const control = createTraitControl(values[name] || baseDie, (chosen) => {
            const skills = getByPath(context.character, context.field) || {};
            if (chosen === baseDie) delete skills[name];
            else skills[name] = chosen;
            setByPath(context.character, context.field, skills);
            if (!editing) refresh();
            else {
              signature = JSON.stringify(skills);
              count.textContent = `${Object.values(skills).filter((value) => traitMaximum(value) > baseDie).length} perícias registradas`;
            }
            context.onChange?.();
          }, { label: name, scale, allowNone: false, allowComposite: context.allowComposite });
          row.appendChild(control.element);
          list.appendChild(row);
        });
        group.appendChild(list);
        groups.appendChild(group);
      });
      count.textContent = `${visibleCount} ${visibleCount === 1 ? 'perícia registrada' : 'perícias registradas'}`;
      if (!groups.children.length) groups.appendChild(element('p', 'engine-empty', context.emptyLabel || 'Nenhuma perícia registrada.'));
      toggle.textContent = editing ? (context.doneLabel || 'Concluir edição') : (context.editLabel || 'Editar perícias');
      toggle.setAttribute('aria-expanded', String(editing));
    };
    toggle.addEventListener('click', () => {
      editing = !editing;
      refresh();
    });
    toolbar.append(count, toggle);
    wrap.append(toolbar, groups);
    refresh();
    context.registerRefresh?.(() => {
      if (JSON.stringify(getByPath(context.character, context.field) || {}) !== signature) refresh();
    });
    container.appendChild(wrap);
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
  search(context) {
    // Fórmulas de rolagem só são executadas pelo botão da ficha.
    const value = context.mode === 'roll' ? 'Rolagem sob demanda' : formatValue(evaluate(context.system.formulas[context.formula], {
      vars: resolveFormulaVariables(context.variables, context.character, context.system, false), data: context.character,
    }), context.format);
    return [{ label: context.label, value }];
  },
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
        try {
        const variables = resolveFormulaVariables(context.variables, context.character, context.system, true);
        const value = evaluate(context.system.formulas[context.formula], { vars: variables, data: context.character });
        output.value = formatValue(value, context.format);
        output.textContent = output.value;
        } catch (error) { output.value = '—'; output.textContent = '—'; output.title = error.message; notify(error.message, {type: 'error'}); }
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
      const top = element('div', 'engine-slot__top');
      const label = element('span', 'engine-slot__label', context.levelLabel?.replace('{level}', slot.level) || `Nível ${slot.level}`);
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
      const maxRow = element('label', 'engine-slot__maximum');
      maxRow.append(element('span', '', 'Máx.'), maximum);
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
      top.append(label, decrement, count, increment);
      row.append(top, maxRow);
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
    const placeholder = element('div', 'engine-image__placeholder', context.placeholder || '◇');
    placeholder.setAttribute('aria-hidden', 'true');
    const controls = element('div', 'engine-image__controls');
    const upload = buttonElement('Escolher imagem', 'button button--ghost');
    const remove = buttonElement('Remover', 'button button--ghost');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'visually-hidden';
    const refresh = () => {
      const raw = getByPath(context.character, context.field);
      const source = safeImageSource(raw);
      placeholder.textContent = raw && !source ? 'Retrato externo preservado; não carregado automaticamente.' : (context.placeholder || '◇');
      preview.hidden = !source;
      placeholder.hidden = Boolean(source);
      remove.hidden = !source;
      if (source) preview.src = source; else preview.removeAttribute('src');
    };
    upload.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const [file] = input.files;
      if (!file) return;
      try {
        setByPath(context.character, context.field, await compressPortrait(file));
        refresh();
        context.onChange?.();
      } catch (error) { notify(error.message, {type: 'error'}); }
      finally { input.value = ''; }
    });
    remove.addEventListener('click', () => {
      setByPath(context.character, context.field, null);
      refresh();
      context.onChange?.();
    });
    controls.append(upload, remove, input);
    wrap.append(preview, placeholder, controls);
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
  const wrap = fieldBlock(context.toolbarTitle ? null : context.label, `engine-collection engine-collection--${context.variant || 'cards'}`);
  const toolbar = element('div', 'engine-collection__toolbar');
  const count = element('span', 'engine-collection__count');
  const add = buttonElement(context.addLabel || 'Adicionar', 'button button--primary');
  const entries = element('div', 'engine-entry-list');
  let values = ensureArray(context.character, context.field);
  if (context.textEntryField) values.forEach((value, index) => {
    if (typeof value === 'string') values[index] = { id: createId(), ...defaultsFromSchema(context.itemSchema, context), ...context.textEntryDefaults, [context.textEntryField]: value };
  });
  let signature = JSON.stringify(values);
  const entryRefreshers = new Set();
  const costTotal = context.creationCost ? element('output', 'engine-collection__cost') : null;
  if (costTotal) costTotal.setAttribute('aria-label', `Custo de criação de ${context.label}`);
  const refreshCost = () => {
    if (!costTotal) return;
    const costs = values.map((item) => creationItemCost(item, context));
    costTotal.textContent = costs.includes(null) ? 'Custo a definir com a mesa' : `${costs.reduce((sum, cost) => sum + cost, 0)} pontos · custo cumulativo das escolhas atuais`;
  };
  const entryContext = {
    ...context,
    registerRefresh(refresh) {
      entryRefreshers.add(refresh);
      return () => entryRefreshers.delete(refresh);
    },
    onChange() {
      signature = JSON.stringify(values);
      context.onChange?.();
    },
  };
  if (context.toolbarTitle) toolbar.appendChild(element('h2', 'engine-collection__heading', context.heading || context.label));
  toolbar.append(count, add);

  const refresh = () => {
    entryRefreshers.clear();
    values = ensureArray(context.character, context.field);
    const restoreFocus = captureFocus(entries);
    entries.innerHTML = '';
    count.textContent = `${values.length} ${values.length === 1 ? 'item' : 'itens'}`;
    add.hidden = Number.isInteger(context.fixedLength) && values.length >= context.fixedLength;
    if (!values.length) entries.appendChild(element('p', 'engine-empty', context.emptyLabel || 'Nenhum item cadastrado.'));
    values.forEach((item, index) => entries.appendChild(renderEntry(item, index, values, entryContext, refresh)));
    signature = JSON.stringify(values);
    refreshCost();
    restoreFocus();
  };
  add.addEventListener('click', () => {
    if (Number.isInteger(context.fixedLength) && values.length >= context.fixedLength) return;
    values.push({ id: createId(), ...defaultsFromSchema(context.itemSchema, context) });
    refresh();
    context.onChange?.();
  });
  wrap.append(toolbar);
  if (costTotal) wrap.appendChild(costTotal);
  wrap.appendChild(entries);
  refresh();
  context.registerRefresh?.(() => {
    if (JSON.stringify(getByPath(context.character, context.field)) !== signature) refresh();
    entryRefreshers.forEach((update) => update());
    refreshCost();
  });
  container.appendChild(wrap);
}

function renderEntry(item, index, values, context, refreshList) {
  const entry = document.createElement('details');
  entry.className = 'engine-entry';
  entry.dataset.entryId = item.id || String(index);
  entry.open = context.defaultOpen ?? values.length <= 3;
  const summary = document.createElement('summary');
  summary.className = 'engine-entry__summary';
  const title = element('strong', 'engine-entry__title', entryTitle(item, index));
  const meta = element('span', 'engine-entry__meta', entryMeta(item, context));
  summary.append(title, meta);
  if (context.reorderable) {
    for (const [direction, label] of [[-1, 'Mover para cima'], [1, 'Mover para baixo']]) {
      const move = buttonElement(direction < 0 ? '↑' : '↓', 'button button--ghost engine-entry__move');
      move.setAttribute('aria-label', `${label}: ${entryTitle(item, index)}`);
      move.disabled = index + direction < 0 || index + direction >= values.length;
      move.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        [values[index], values[index + direction]] = [values[index + direction], values[index]];
        refreshList();
        context.onChange?.();
      });
      summary.appendChild(move);
    }
  }
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
  if (context.creationCost) {
    const output = element('output', 'engine-entry__cost');
    output.setAttribute('aria-label', 'Custo de criação');
    const update = () => { const cost = creationItemCost(item, context); output.textContent = cost === null ? 'Custo a definir com a mesa' : `${cost} pontos de criação`; };
    update();
    context.registerRefresh?.(update);
    body.appendChild(output);
  }
  Object.entries(context.itemSchema || {}).forEach(([key, definition]) => {
    body.appendChild(renderItemField(item, key, definition, context, () => {
      title.textContent = entryTitle(item, index);
      meta.textContent = entryMeta(item, context);
      context.onChange?.();
    }));
  });
  if (context.type === 'stateList') body.appendChild(renderStateEffect(item, context, () => {
    const gradeField = context.gradeField || 'sides';
    const gradeControl = [...body.querySelectorAll('.engine-item-field')]
      .find((field) => field.dataset.itemField === gradeField)?.querySelector('select');
    if (gradeControl) gradeControl.value = String(item[gradeField] ?? '');
    meta.textContent = entryMeta(item, context);
    context.onChange?.();
  }, () => {
    values.splice(values.indexOf(item), 1);
    refreshList();
    context.onChange?.();
  }));
  entry.append(summary, body);
  return entry;
}

function renderStateEffect(item, context, onChange, onRemove) {
  const gradeField = context.gradeField || 'sides';
  const wrap = fieldBlock(context.effectLabel || 'Aplicar efeito', 'engine-state-effect');
  const controls = element('div', 'engine-state-effect__controls');
  const selector = document.createElement('select');
  selector.setAttribute('aria-label', 'Dado do efeito');
  (context.dieScale || []).forEach((sides) => selector.appendChild(optionElement(sides, `d${sides}`)));
  const apply = buttonElement('Aplicar efeito', 'button button--ghost');
  const feedback = element('span', 'engine-state-effect__feedback');
  apply.addEventListener('click', () => {
    const result = applyEffectToGradedState(item[gradeField], Number(selector.value), context.dieScale);
    item[gradeField] = result.sides;
    const labels = {
      created: `Estado criado em d${result.sides}.`,
      raised: `Estado elevado para d${result.sides}.`,
      upgraded: result.ascension ? `Estado em d${result.sides}: 1 Ascensão.` : `Estado aprimorado para d${result.sides}.`,
      unchanged: `O efeito não altera o Estado d${result.sides}.`,
    };
    feedback.textContent = labels[result.mode];
    if (result.ascension && context.overflow) {
      const policy = context.overflow;
      const next = getByPath(context.character, policy.field) || [];
      let linked = next.find((state) => state.parentId === item.id);
      if (!linked) {
        linked = { id: createId(), parentId: item.id, name: item.name || policy.defaultName, [gradeField]: policy.startDie };
        next.push(linked);
        (policy.onFirst || []).forEach((effect) => setByPath(context.character, effect.field, effect.value));
        feedback.textContent = `Limite de Desgaste: ${linked.name} gera Trauma d${policy.startDie}. Verifique a Retirada de Cena e as exceções da mesa.`;
      } else {
        const up = stepUp(linked[gradeField], context.dieScale);
        if (up.overflow) {
          (policy.onLimit || []).forEach((effect) => setByPath(context.character, effect.field, effect.value));
          feedback.textContent = 'Desgaste e Trauma atingiram o limite: a regra indica morte, salvo exceção. Confirme a consequência com a mesa.';
        } else {
          linked[gradeField] = up.sides;
          feedback.textContent = `Trauma elevado para d${up.sides}.`;
        }
      }
      setByPath(context.character, policy.field, next);
    }
    if (result.changed) onChange();
  });
  controls.append(selector, apply);
  wrap.append(controls, feedback);
  if (context.recovery) {
    const recovery = element('div', 'engine-recovery');
    recovery.appendChild(element('h4', '', 'Cura / redução de estado'));
    const outcome = document.createElement('select');
    outcome.setAttribute('aria-label', 'Resultado da cura');
    outcome.append(optionElement('', 'Escolha o resultado'), optionElement('success', 'Sucesso'), optionElement('failure', 'Falha'));
    const potency = document.createElement('select');
    potency.setAttribute('aria-label', 'Potência da cura');
    (context.dieScale || []).forEach((sides) => potency.appendChild(optionElement(sides, `d${sides}`)));
    const limited = document.createElement('input');
    limited.type = 'checkbox';
    const limitLabel = element('label', 'field field--checkbox');
    limitLabel.append(limited, element('span', '', 'Limitar a uma Redução (descanso curto)'));
    const heal = buttonElement('Aplicar cura', 'button button--ghost');
    const resultText = element('p', 'engine-recovery__feedback');
    heal.addEventListener('click', () => {
      if (!outcome.value) { resultText.textContent = 'Informe o resultado do teste de cura já resolvido.'; return; }
      const grade = healState(item[gradeField], Number(potency.value), outcome.value === 'success', context.dieScale || [], limited.checked);
      if (grade === null) { onRemove(); return; }
      item[gradeField] = grade;
      resultText.textContent = outcome.value === 'success' ? `Estado reduzido para d${grade}.` : 'Falha: o estado permanece sem alteração.';
      onChange();
    });
    recovery.append(outcome, potency, limitLabel, heal, resultText, element('small', '', context.recovery.note || 'Sucesso reduz um nível; Potência maior remove o estado. A mesa confirma as condições para tratar Trauma.'));
    wrap.appendChild(recovery);
  }
  return wrap;
}

function renderTable(container, context) {
  const wrap = fieldBlock(context.toolbarTitle ? null : context.label, 'engine-table');
  const toolbar = element('div', 'engine-collection__toolbar');
  const count = element('span', 'engine-collection__count');
  const add = buttonElement(context.addLabel || 'Adicionar item', 'button button--primary');
  let search = null;
  if (context.searchable) {
    search = document.createElement('input');
    search.type = 'search';
    search.className = 'engine-table__search';
    search.placeholder = context.searchPlaceholder || 'Pesquisar itens…';
    search.setAttribute('aria-label', context.searchLabel || `Pesquisar ${context.label || 'itens'}`);
    search.addEventListener('input', () => refresh());
  }
  if (context.toolbarTitle) toolbar.appendChild(element('h2', 'engine-collection__heading', context.heading || context.label));
  toolbar.append(count);
  if (search) toolbar.appendChild(search);
  toolbar.appendChild(add);
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
  const empty = element('p', 'engine-empty', context.emptyLabel || 'Nenhum item cadastrado.');
  const values = ensureArray(context.character, context.field);

  const refresh = () => {
    body.innerHTML = '';
    count.textContent = `${values.length} ${values.length === 1 ? 'item' : 'itens'}`;
    const query = search?.value.trim().toLocaleLowerCase('pt-BR') || '';
    const visibleItems = values.map((item, index) => ({ item, index })).filter(({ item }) =>
      !query || Object.values(item).some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(query)));
    if (query) count.textContent = `${visibleItems.length} de ${values.length} itens`;
    scroll.hidden = visibleItems.length === 0;
    empty.hidden = visibleItems.length !== 0;
    empty.textContent = values.length ? 'Nenhum item corresponde à pesquisa.' : (context.emptyLabel || 'Nenhum item cadastrado.');
    visibleItems.forEach(({ item, index }) => {
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
      const remove = buttonElement(context.removeLabel || 'Remover', 'button button--ghost');
      remove.setAttribute('aria-label', 'Remover');
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
  wrap.append(toolbar, scroll, empty);
  refresh();
  container.appendChild(wrap);
}

function renderItemField(item, key, definition, context, onChange, { hideLabel = false } = {}) {
  const config = normalizeDefinition(key, definition);
  const wrap = element('label', hideLabel ? 'engine-item-field engine-item-field--compact' : 'field engine-item-field');
  wrap.dataset.itemField = key;
  if (!hideLabel) wrap.appendChild(element('span', '', config.label));
  if (config.help) appendFieldHelp(wrap, config.help, config.label);
  if (config.type === 'die') {
    const control = createTraitControl(item[key], (value) => { item[key] = value; onChange(); }, {
      label: config.label, scale: context.dieScale || [], allowComposite: config.allowComposite,
    });
    wrap.appendChild(control.element);
    context.registerRefresh?.(() => control.update(item[key]));
    return wrap;
  }
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

  if (config.type === 'boolean') control.checked = Boolean(item[key] ?? config.default);
  else control.value = item[key] ?? '';
  control.setAttribute('aria-label', config.label);
  const eventName = config.type === 'boolean' || config.type === 'select' || config.type === 'die' ? 'change' : 'input';
  control.addEventListener(eventName, () => {
    if (config.type === 'boolean') item[key] = control.checked;
    else if (config.type === 'number') item[key] = config.default === null && control.value === '' ? null : numberValue(control);
    else if (config.type === 'die') item[key] = control.value === '' ? null : Number(control.value);
    else if (config.type === 'select' && config.valueType === 'number') item[key] = control.value === '' ? null : Number(control.value);
    else if (config.type === 'reference' && config.multiple) {
      item[key] = control.value.split(',').map((value) => value.trim()).filter(Boolean);
    }
    else item[key] = control.value;
    onChange();
  });
  wrap.appendChild(control);
  return wrap;
}

function creationItemCost(item, context) {
  const config = context.creationCost;
  return stepCost(config.baseDie, item[config.valueField] ?? config.baseDie, context.dieScale || [], getByPath(context.system, config.costsFrom));
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
      const dice = element('strong', '');
      dice.appendChild(createDiceLabel(traitDice(trait.dice ? { dice: trait.dice } : trait.sides)));
      label.append(input, element('span', '', trait.label), dice);
      checklist.appendChild(label);
    });
    if (!traits.length) checklist.appendChild(element('p', 'engine-empty', 'Nenhum Traço disponível para a Pool.'));
  };
  refreshTraits();
  context.registerRefresh?.(refreshTraits);

  const actions = element('div', 'engine-pool__actions');
  const extraLabel = fieldLabel('Dados de apoio / ajustes temporários');
  const extra = document.createElement('input');
  extra.type = 'text';
  extra.placeholder = 'd4, d6 (fontes separadas); d12 + d6 (traço composto)';
  extraLabel.appendChild(extra);
  const extraNote = element('small', '', 'Somente fontes relevantes, sem repetir um Traço selecionado. Para um Aprimoramento temporário, omita o dado original e informe o substituto; uma Ascensão temporária acrescenta um d6 separado, não um Traço Composto.');
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
    if (extra.value.trim()) {
      const parsed = extra.value.split(',').map((value) => parseTrait(value.trim(), context.system.dieScale || []));
      if (parsed.some((value) => value === null)) {
        result.replaceChildren(element('p', 'engine-callout', 'Dados de apoio inválidos: use dados da escala, separados por vírgula; + compõe um único Traço.'));
        actorPool = null;
        return;
      }
      selected.push(...parsed.map((value, index) => ({ source: `manual:${index}`, label: `Apoio ${index + 1}`, ...traitDescriptor(value) })));
    }
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
  const diceLabel = fieldLabel('Dados da oposição (opcional)');
  const opponentDice = document.createElement('input');
  opponentDice.type = 'text';
  opponentDice.placeholder = 'd8, d8, d6 (ex.: cura de estado d6)';
  diceLabel.appendChild(opponentDice);
  const resolveButton = buttonElement(context.resolveLabel || 'Resolver ação', 'button button--primary');
  const resolution = element('div', 'engine-pool__resolution');
  resolveButton.addEventListener('click', () => {
    renderResolution(resolution, actorPool, preset.value, manual.value, potency.value, context.system, opponentDice.value);
  });
  opposition.append(presetLabel, manualLabel, diceLabel, resolveButton);
  wrap.append(checklist, extraLabel, extraNote, actions, result, opposition, resolution);
  container.appendChild(wrap);
}

export function renderActorPoolResult(container, pool, potency, system) {
  container.innerHTML = '';
  potency.innerHTML = '';
  if (pool.emptyPool) {
    container.appendChild(element('p', 'engine-callout engine-callout--danger', 'Pool vazia: falha automática.'));
    return;
  }
  const rolls = element('div', 'engine-pool__rolls');
  pool.rolls.forEach((roll) => {
    const item = element('span', 'engine-roll');
    const dice = roll.componentRolls?.length ? roll.componentRolls.map((die) => die.sides) : [roll.sides];
    const role = pool.apex === roll && pool.base === roll ? 'Ápice e Base' : pool.apex === roll ? 'Ápice' : pool.base === roll ? 'Base' : 'Potência disponível';
    const detail = element('small', 'engine-roll__die');
    detail.append(createDiceLabel(dice), ' · ');
    const roles = pool.apex === roll && pool.base === roll ? ['apice', 'base'] : [pool.apex === roll ? 'apice' : pool.base === roll ? 'base' : 'potencia'];
    roles.forEach((name) => detail.appendChild(createRuleGlyph(name)));
    detail.append(role);
    item.append(
      element('span', '', roll.label),
      element('strong', '', `${roll.result}`),
      detail,
    );
    rolls.appendChild(item);
  });
  const summary = element('p', 'engine-pool__summary');
  summary.append(createRuleGlyph('peso'), 'Peso ', element('strong', '', String(pool.weight)));
  const potencyLabel = fieldLabel('Potência');
  potencyOptions(pool, system.dieScale?.[0] || 4).forEach((item) => {
    potency.appendChild(optionElement(item.sides, `d${item.sides}${item.forced ? ' (mínima)' : ''}`));
  });
  potencyLabel.appendChild(potency);
  container.append(rolls, summary, potencyLabel);
}

export function renderResolution(container, actorPool, presetId, manualValue, potencyValue, system, diceValue = '') {
  container.innerHTML = '';
  if (!actorPool || actorPool.emptyPool) {
    container.appendChild(element('p', 'engine-callout engine-callout--danger', 'Role uma Pool válida primeiro.'));
    return;
  }
  let opponentWeight;
  let detail;
  if (diceValue.trim()) {
    const dice = diceValue.split(',').map((value) => parseTrait(value.trim(), system.dieScale || []));
    if (dice.some((value) => value === null)) {
      container.appendChild(element('p', 'engine-callout', 'Dados de oposição inválidos: use dados da escala separados por vírgula.'));
      return;
    }
    const opposition = rollPool(dice.map((value, index) => ({ source: `opponent:${index}`, ...traitDescriptor(value) })));
    opponentWeight = opposition.weight;
    detail = `Oposição: ${opposition.rolls.map((roll) => roll.result).join(', ')} · Peso ${opponentWeight}`;
  } else if (manualValue !== '') {
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
    const improved = stepUp(Number(potencyValue), system.dieScale);
    const detailText = improved.overflow
      ? `Potência Excepcional: d${potencyValue} + 1 Ascensão.`
      : `Potência aprimorada: d${potencyValue} → d${improved.sides}.`;
    container.appendChild(element('p', 'engine-callout', detailText));
  }
  return outcome;
}

function collectTraits(sources, character, system) {
  return sources.flatMap((source) => {
    if (source.kind === 'constant') {
      const sides = source.sidesFrom ? getByPath(system, source.sidesFrom) : source.sides;
      return traitDice(sides).length ? [{ source: source.id, label: source.label, ...traitDescriptor(sides) }] : [];
    }
    if (source.kind === 'field') {
      const sides = getByPath(character, source.field);
      return sides ? [{ source: source.id || source.field, label: source.label, ...traitDescriptor(sides) }] : [];
    }
    if (source.kind === 'entries') {
      const entries = getByPath(character, source.field) || {};
      return Object.entries(entries).flatMap(([key, sides]) => sides ? [{
        source: interpolate(source.id || key, { key, name: key }),
        label: interpolate(source.label || key, { key, name: key }),
        ...traitDescriptor(sides),
      }] : []);
    }
    const collection = source.from === 'system' ? getByPath(system, source.collection) : getByPath(character, source.collection);
    if (!Array.isArray(collection)) return [];
    return collection.flatMap((item) => {
      if (source.require && !getByPath(item, source.require)) return [];
      if (source.excludeWhen && getByPath(item, source.excludeWhen.field) === source.excludeWhen.equals) return [];
      const context = item && typeof item === 'object' ? item : { value: item, key: item, name: item, label: item };
      const sidesPath = interpolate(source.sides, context);
      const sides = source.from === 'system' ? getByPath(character, sidesPath) : getByPath(item, sidesPath);
      if (!sides) return [];
      return [{
        source: interpolate(source.id || sidesPath, context),
        label: interpolate(source.label, context),
        ...traitDescriptor(sides),
      }];
    });
  });
}

function resolveFormulaVariables(definitions = {}, character, system, roll) {
  return Object.fromEntries(Object.entries(definitions).map(([key, definition]) => {
    if (definition.traitMaxField) return [key, traitMaximum(getByPath(character, definition.traitMaxField))];
    if (definition.field) return [key, getByPath(character, definition.field) ?? 0];
    if (definition.system) return [key, getByPath(system, definition.system) ?? 0];
    if (definition.rollField) {
      const sides = getByPath(character, definition.rollField);
      return [key, roll && sides ? traitDice(sides).reduce((sum, die) => sum + rollOne(die), 0) : 0];
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

function entryMeta(item, context = {}) {
  if (Array.isArray(context.summaryFields)) {
    return context.summaryFields.map((field) => item[field]).filter((value) => value !== '' && value != null).join(' · ');
  }
  const parts = [];
  const sides = item.die ?? item.sides ?? item.currentDie;
  if (sides) parts.push(traitLabel(sides));
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
