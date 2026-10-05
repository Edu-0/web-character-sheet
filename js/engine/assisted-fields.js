import { createCalculationControl } from './calculation-overrides.js';
import {COMPONENT_CONTRACTS} from '../validation/contracts.js';
import { registerFieldType } from './fields.js';
import { getByPath, setByPath } from './paths.js';
import { executeSheetAction, inventoryCalculationKey, inventoryTotals, repertoireStatus, undoSheetAction } from './assistance.js';
import { traitLabel } from './traits.js';

registerFieldType('inventorySummary', {
  search(context) {
    const totals = inventoryTotals(context.character, context);
    return [
      { label: 'Peso carregado', value: `${totals.weight.toLocaleString('pt-BR')} kg` },
      { label: 'Capacidade de carga', value: `${totals.capacity.toLocaleString('pt-BR')} kg` },
      { label: 'Sobrecarga', value: `${totals.excess.toLocaleString('pt-BR')} kg` },
    ];
  },
  render(container, context) {
    const wrap = node('div', 'engine-inventory-summary engine-callout');
    const weight = node('output');
    weight.setAttribute('aria-label', 'Peso carregado');
    const capacity = node('output');
    capacity.setAttribute('aria-label', 'Capacidade de carga');
    const warning = node('p');
    warning.setAttribute('role', 'status');
    wrap.append(node('h3', '', context.label || 'Carga'), weight, capacity, warning);
    const refresh = () => {
      const totals = inventoryTotals(context.character, context);
      weight.textContent = `${totals.weight.toLocaleString('pt-BR')} kg carregados`;
      capacity.textContent = `${totals.capacity.toLocaleString('pt-BR')} kg de capacidade`;
      warning.textContent = totals.excess ? `Sobrecarga de ${totals.excess.toLocaleString('pt-BR')} kg. A mesa define as penalidades.` : 'Carga dentro do limite.';
      wrap.classList.toggle('engine-callout--danger', totals.excess > 0);
    };
    if (context.override !== false) for (const [stat, label] of [['weight', 'Peso carregado'], ['capacity', 'Capacidade de carga'], ['excess', 'Sobrecarga']]) {
      wrap.append(createCalculationControl({ ...context, key: inventoryCalculationKey(context, stat), label,
        automatic: () => inventoryTotals(context.character, context, stat)[stat] }));
    }
    refresh();
    context.registerRefresh?.(refresh);
    container.appendChild(wrap);
  },
});

registerFieldType('repertoire', {
  search(context) {
    const config = getByPath(context.system, context.configFrom);
    return repertoireStatus(context.character, context.system, config).map(({ specialization, techniques, remaining }) => ({
      label: `Repertório de ${specialization.name || 'Especialização sem nome'}`,
      value: `${traitLabel(specialization[config.gradeField])} · ${techniques.length} técnicas conhecidas · ${remaining.length} opções disponíveis`,
    }));
  },
  render(container, context) {
    const wrap = node('div', 'engine-repertoire');
    const config = getByPath(context.system, context.configFrom);
    const refresh = () => {
      wrap.replaceChildren(node('h3', '', context.label || 'Repertório garantido'));
      const entries = repertoireStatus(context.character, context.system, config);
      if (!entries.length) wrap.appendChild(node('p', 'engine-empty', 'Adicione uma Especialização para acompanhar seu repertório.'));
      entries.forEach(({ specialization, definition, techniques, remaining, excess }) => {
        const card = node('article', 'engine-callout');
        card.append(node('h4', '', specialization.name || 'Especialização sem nome'), node('p', '', `${traitLabel(specialization[config.gradeField])} · ${techniques.length} técnicas conhecidas`));
        if (!definition) card.appendChild(node('p', '', 'Repertório excepcional: a distribuição é definida pela campanha.'));
        else {
          card.append(node('p', '', `Mínimo garantido: ${definition.freeCount}. Distribuição: ${definition.grants.map((slot) => `${slot.count} × d${slot.sides}`).join(' + ')}.`));
          card.append(node('p', '', remaining.length ? `Opções ainda disponíveis: ${remaining.map((sides) => `d${sides}`).join(', ')}.` : 'Distribuição garantida preenchida.'));
          if (excess) card.appendChild(node('p', '', `${excess} técnicas excedem essa distribuição; registre outra origem de aprendizado quando aplicável.`));
        }
        card.appendChild(node('small', '', 'É um mínimo, não um limite de aprendizado. Promoções substituem dados anteriores.'));
        wrap.appendChild(card);
      });
    };
    refresh();
    context.registerRefresh?.(refresh);
    container.appendChild(wrap);
  },
});

registerFieldType('traitAllocation', {
  search(context) {
    const values = getByPath(context.character, context.field) || {};
    return [{ label: context.label, value: (getByPath(context.system, context.traitsFrom) || []).map((trait) => `${trait.label || trait.key}: ${traitLabel(values[trait.key])}`).join(' · ') }];
  },
  render(container, context) {
    const wrap = node('div', 'engine-allocation engine-callout');
    const select = document.createElement('select');
    select.setAttribute('aria-label', context.label || 'Conjunto de atributos');
    const presets = getByPath(context.system, context.presetsFrom) || [];
    presets.forEach((preset) => select.appendChild(option(preset.id, `${preset.label}: ${preset.dice.map((die) => `d${die}`).join(', ')}`)));
    const apply = button('Aplicar conjunto');
    const feedback = node('p');
    feedback.setAttribute('role', 'status');
    apply.addEventListener('click', () => {
      const chosen = presets.find((preset) => preset.id === select.value);
      const traits = getByPath(context.system, context.traitsFrom) || [];
      if (!chosen || chosen.dice.length !== traits.length) return;
      const values = { ...(getByPath(context.character, context.field) || {}) };
      traits.forEach((trait, index) => { values[trait.key] = chosen.dice[index]; });
      setByPath(context.character, context.field, values);
      feedback.textContent = 'Conjunto aplicado. Distribua os dados entre os atributos conforme sua campanha.';
      context.onChange?.();
    });
    wrap.append(node('h3', '', context.label), select, apply, node('p', 'engine-section__note', 'Aplicar substitui os dados atuais. A campanha escolhe o conjunto; uma Redução de d6 ou d8 pode financiar um Aprimoramento.'), feedback);
    container.appendChild(wrap);
  },
});

registerFieldType('actionGroup', {
  search(context) {
    const event = getByPath(context.character, context.historyField || 'scene.lastAction');
    return (getByPath(context.system, context.actionsFrom) || []).map((action) => ({
      label: action.label, value: event?.label === action.label ? event.details.join(' ') : 'Ação de cena · confirme as condições com a mesa', actionLabel: action.label,
    }));
  },
  revealSearchResult(wrapper, entry) {
    return [...wrapper.querySelectorAll('button')].find((button) => button.textContent === entry.actionLabel) || wrapper;
  },
  render(container, context) {
    const wrap = node('div', 'engine-actions');
    const row = node('div', 'engine-budget__actions');
    const feedback = node('p', 'engine-callout');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-label', context.label || 'Resultado da ação');
    const undo = button('Desfazer última ação');
    const historyField = context.historyField || COMPONENT_CONTRACTS.actionGroup.properties.historyField.default;
    (getByPath(context.system, context.actionsFrom) || []).forEach((action) => {
      const control = button(action.label);
      control.addEventListener('click', () => {
        try {
          const event = executeSheetAction(context.character, action, context.system);
          event.note = action.note || '';
          setByPath(context.character, historyField, event);
          context.onChange?.();
        } catch (error) { feedback.textContent = error.message; }
      });
      row.appendChild(control);
    });
    undo.addEventListener('click', () => {
      const event = getByPath(context.character, historyField);
      if (!undoSheetAction(context.character, event)) {
        feedback.textContent = 'A ficha mudou após esta ação; ajuste os valores manualmente para corrigir.';
        return;
      }
      setByPath(context.character, historyField, null);
      context.onChange?.();
    });
    const refresh = () => {
      const event = getByPath(context.character, historyField);
      undo.hidden = !event;
      feedback.textContent = event ? `${event.label}. ${event.details.join(' ')} ${event.note || ''} ${context.note || ''}` : (context.note || '');
      feedback.hidden = !feedback.textContent;
    };
    wrap.append(row, feedback, undo);
    refresh();
    context.registerRefresh?.(refresh);
    container.appendChild(wrap);
  },
});

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text || '';
  return element;
}

function option(value, text) {
  const element = node('option', '', text);
  element.value = value;
  return element;
}

function button(text) {
  const element = node('button', 'button button--ghost', text);
  element.type = 'button';
  return element;
}
