import { openModal } from '../modal.js';
import { rollExpression } from '../dice.js';
import { getByPath, setByPath } from './paths.js';
import { evaluate } from './formula.js';
import { calculationValue } from './calculation-overrides.js';
import { parseDiceExpression, scaleDiceExpression, formatDiceExpression } from './dice-expression.js';
import { registerEntryAction } from './entry-actions.js';

const valueResolvers = new Map();
export function registerRollValueResolver(name, resolver) { valueResolvers.set(name, resolver); }

export function rollValue(source, context) {
  if (source === undefined) return undefined;
  let value;
  if (Object.hasOwn(source, 'value')) value = source.value;
  else if (source.itemField) value = getByPath(context.item, source.itemField);
  else if (source.field) value = getByPath(context.character, source.field);
  else if (source.resolver) {
    const resolve = valueResolvers.get(source.resolver);
    if (!resolve) throw new Error(`Resolvedor indisponível: ${source.resolver}.`);
    value = resolve(context);
  } else if (source.formula) {
    const formula = Object.hasOwn(context.system.formulas || {}, source.formula) ? context.system.formulas[source.formula] : undefined;
    if (!formula) throw new Error(`Fórmula indisponível: ${source.formula}.`);
    const vars = Object.fromEntries(Object.entries(source.variables || {}).map(([key, definition]) => [key, rollValue(definition, context)]));
    value = evaluate(formula, { vars, data: context.character });
  }
  if ((value == null || value === '') && Object.hasOwn(source, 'fallback')) value = source.fallback;
  return source.overrideKey ? calculationValue(context.character, source.overrideKey, value) : value;
}

const node = (tag, text = '') => { const el = document.createElement(tag); el.textContent = text; return el; };
const integer = (value, label, { min = -1000000, max = 1000000 } = {}) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}: informe um inteiro entre ${min} e ${max}.`);
  return value;
};

// Confere a disponibilidade inteira antes de devolver uma única mutação.
export function prepareRollCost(resource, context, selection, requireAvailable = true) {
  if (!resource) return null;
  const cost = integer(rollValue(resource.cost || { value: 1 }, context), 'Custo', { min: 0 });
  let target = context.character;
  let field = resource.field;
  if (resource.matchField) {
    const list = getByPath(target, resource.field);
    if (!Array.isArray(list)) throw new Error('Lista de recursos indisponível.');
    const matches = list.filter(entry => getByPath(entry, resource.matchField) === selection);
    if (matches.length !== 1) throw new Error(resource.unavailableMessage || 'Recurso indisponível para a opção escolhida.');
    target = matches[0]; field = resource.valueField;
  }
  const current = integer(getByPath(target, field), 'Recurso', { min: 0 });
  const max = resource.mode === 'used' ? integer(getByPath(target, resource.maxField), 'Máximo do recurso', { min: 0 }) : current;
  const remaining = resource.mode === 'used' ? max - current : current;
  if (remaining < 0) throw new Error('Recurso utilizado excede o máximo.');
  if (requireAvailable && remaining < cost) throw new Error(resource.unavailableMessage || 'Recurso insuficiente. Desmarque o consumo ou escolha outro valor.');
  return { remaining, max, cost, apply: () => setByPath(target, field, resource.mode === 'used' ? current + cost : current - cost) };
}

registerEntryAction('roll', context => createEntryRollButton(context, context.system.entryRolls[context.rollPreset ?? context.rollConfigFrom]));

export function createEntryRollButton(context, config) {
  const button = node('button', config.buttonLabel || 'Rolar');
  button.type = 'button'; button.className = 'button button--ghost source-roll-trigger';
  button.dataset.sourceId = context.item.id || '';
  button.dataset.sourceKind = context.rollPreset || context.rollConfigFrom || config.buttonLabel || 'roll';
  button.addEventListener('click', () => {
    try { openEntryRollPanel(context, config, button); }
    catch (error) { openModal({ title: 'Configuração de rolagem indisponível', contentEl: node('p', error.message), actions: [{ label: 'Fechar' }] }); }
  });
  return button;
}

export function openEntryRollPanel(context, config, trigger) {
  const { item, character, onChange } = context;
  const sourceScope = trigger?.closest('.engine-sheet, #legacy-dnd-sheet, #generic-sheet-host') || document;
  const saved = item.rollOptions || {};
  const content = node('div'); content.className = 'source-roll-panel';
  const form = node('div'); form.className = 'source-roll-fields';
  function input(label, type, value = '') {
    const wrap = node('label'); wrap.className = 'field';
    const control = node('input'); control.type = type; control.value = value;
    control.setAttribute('aria-label', label);
    wrap.append(node('span', label), control); form.append(wrap);
    if (type === 'checkbox') wrap.classList.add('field--checkbox');
    return control;
  }
  const checkConfig = config.check ?? config.test;
  let check, checkExpression, modifier;
  if (checkConfig) {
    check = input(checkConfig.toggleLabel || 'Rolar teste', 'checkbox');
    check.checked = saved.checkEnabled ?? saved.testEnabled ?? saved.attack ?? checkConfig.enabled ?? true;
    checkExpression = input(checkConfig.expressionLabel || 'Dados do teste', 'text', saved.checkExpression ?? saved.testExpression ?? rollValue(checkConfig.expression, context) ?? '');
    modifier = input(checkConfig.modifierLabel || 'Modificador do teste', 'text', saved.modifier ?? saved.attackModifier ?? '');
    modifier.placeholder = 'Vazio para usar o valor da ficha';
  }
  const effect = input(config.effect?.label || 'Dados de dano ou efeito', 'text', saved.effect ?? rollValue(config.effect?.expression, context) ?? '');
  effect.placeholder = 'Ex.: 3d6 + 4 · vazio para não rolar';
  const base = config.scale ? rollValue(config.scale.base, context) : undefined;
  const scaleError = config.scale && (!Number.isSafeInteger(base) || base < 0 || base > config.scale.max || base >= config.scale.min && (base - config.scale.min) % (config.scale.step || 1)) ? 'Valor base fora da escala configurada.' : '';
  const scaling = config.scale && !scaleError && base >= config.scale.min;
  let selection, extra, consume;
  if (scaling) {
    const label = node('label'); label.className = 'field';
    selection = node('select'); selection.setAttribute('aria-label', config.scale.label || 'Intensidade');
    for (let value = base; value <= config.scale.max; value += config.scale.step || 1) {
      const option = node('option', String(value)); option.value = value; selection.append(option);
    }
    label.append(node('span', config.scale.label || 'Intensidade'), selection); form.append(label);
    extra = input(config.scale.incrementLabel || 'Dados adicionais por passo', 'text', saved.increment ?? saved.upcast ?? rollValue(config.scale.increment, context) ?? '');
    extra.placeholder = 'Ex.: 1d6 · vazio se não houver aumento';
  } else if (config.scale?.noScaleHelp) content.append(node('p', config.scale.noScaleHelp));
  const resource = config.resource && (!config.resource.matchField || scaling) ? config.resource : null;
  if (resource) consume = input(resource.label || 'Consumir recurso', 'checkbox');
  const preview = node('output'); preview.className = 'source-roll-preview'; preview.setAttribute('aria-label', 'Prévia da rolagem');
  const resourceStatus = node('p'); resourceStatus.className = 'source-roll-resource-status';
  const error = node('p'); error.className = 'source-roll-error'; error.setAttribute('role', 'alert');
  const result = node('div'); result.className = 'source-roll-result'; result.setAttribute('role', 'status');
  const getModifier = () => {
    const value = modifier.value.trim();
    if (!value) {
      const automatic = rollValue(checkConfig.modifier || { value: 0 }, context);
      return integer(typeof automatic === 'string' && /^[+\-]?\d+$/.test(automatic.trim()) ? Number(automatic) : automatic, 'Modificador automático');
    }
    if (!/^[+\-]?\d+$/.test(value)) throw new Error('Informe um modificador inteiro, como +5 ou −2.');
    return integer(Number(value), 'Modificador');
  };
  const getCheck = () => {
    const expression = parseDiceExpression(checkExpression.value);
    expression.modifier += getModifier();
    return scaleDiceExpression(expression, { dice: [], modifier: 0 }, 0);
  };
  const getEffect = () => {
    if (scaleError) throw new Error(scaleError);
    if (!effect.value.trim()) {
      if (extra?.value.trim()) throw new Error('Informe os dados base antes de configurar o aumento.');
      return null;
    }
    return scaleDiceExpression(parseDiceExpression(effect.value), parseDiceExpression(extra?.value || '', { allowEmpty: true }), selection ? (Number(selection.value) - base) / (config.scale.step || 1) : 0);
  };
  const cost = (requireAvailable = true) => prepareRollCost(resource, context, selection ? Number(selection.value) : undefined, requireAvailable);
  const refresh = () => {
    if (modifier) { modifier.disabled = !check.checked; checkExpression.disabled = !check.checked; }
    try {
      const expression = getEffect();
      const parts = [];
      if (check?.checked) parts.push(`${checkConfig.label || 'Teste'}: ${formatDiceExpression(getCheck())}`);
      parts.push(expression ? `${config.effect?.resultLabel || 'Dano/efeito'}: ${formatDiceExpression(expression)}` : 'Sem rolagem de dano/efeito');
      preview.textContent = parts.join(' · '); error.textContent = '';
    } catch (err) { preview.textContent = 'Revise a configuração.'; error.textContent = err.message; }
    if (resource) {
      try { const entry = cost(false); resourceStatus.textContent = `${resource.statusLabel || 'Recurso disponível'}: ${entry.remaining} / ${entry.max} · custo: ${entry.cost}.`; }
      catch (err) { resourceStatus.textContent = err.message; }
    }
  };
  form.addEventListener('input', refresh); form.addEventListener('change', refresh);
  function save() {
    item.rollOptions = {
      ...(check ? { checkEnabled: check.checked, checkExpression: checkExpression.value.trim(), modifier: modifier.value.trim() } : {}),
      effect: effect.value.trim(), increment: extra ? extra.value.trim() : saved.increment ?? saved.upcast ?? '',
    };
    onChange?.();
  }
  function validate() { const effect = getEffect(); return { effect, check: check?.checked ? getCheck() : null }; }
  function showRoll(expression, phase) {
    const entry = rollExpression(expression, `${item.name || 'Ação'} · ${phase}${selection ? ` · ${config.scale.label || 'Intensidade'} ${selection.value}` : ''}`);
    result.replaceChildren(node('strong', `${entry.label}: ${entry.formula} = ${entry.total}`), node('p', entry.groups.map(group => `${group.count}d${group.sides}: ${group.rolls.join(', ')}`).join(' · ') || 'Valor fixo, sem dados.'));
    document.dispatchEvent(new CustomEvent('sheet:rolled', { detail: entry }));
  }
  function run(action) { try { action(); refresh(); } catch (err) { error.textContent = err.message; } }
  if (config.help) content.append(node('p', config.help));
  for (const info of config.info || []) content.append(node('p', `${info.label}: ${rollValue(info.source, context) ?? '—'}`));
  content.append(form, preview, resourceStatus, error, result);
  let dialog;
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, input, select')].filter(el => !el.disabled && el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const actions = [
    { label: 'Salvar configuração', className: 'button button--ghost', closeOnClick: false, onClick: () => run(() => { validate(); save(); result.textContent = 'Configuração salva.'; }) },
    { label: config.submitLabel || 'Rolar', className: 'button button--primary', closeOnClick: false, onClick: () => run(() => {
      const expressions = validate();
      const payment = consume?.checked ? cost() : null;
      payment?.apply(); save();
      if (expressions.check) showRoll(expressions.check, checkConfig.label || 'Teste');
      else if (expressions.effect) showRoll(expressions.effect, config.effect?.resultLabel || 'Dano/efeito');
      else result.textContent = config.noRollMessage || 'Ação registrada sem rolagem.';
    }) },
    { label: config.effect?.buttonLabel || 'Rolar dano / efeito', className: 'button button--ghost', closeOnClick: false, onClick: () => run(() => {
      const expression = getEffect();
      if (!expression) throw new Error('Informe dados ou um valor fixo para o dano/efeito.');
      // Uma configuração inválida do teste não pode ser gravada pelo botão de efeito.
      validate(); save(); showRoll(expression, config.effect?.resultLabel || 'Dano/efeito');
    }) },
  ];
  openModal({ title: `${config.title || config.buttonLabel || 'Rolar'}: ${item.name || 'Ação sem nome'}`, contentEl: content, actions,
    onClose: () => {
      dialog.removeEventListener('keydown', trapFocus);
      queueMicrotask(() => [...sourceScope.querySelectorAll('.source-roll-trigger')].find(button => button.dataset.sourceId === (item.id || '') && button.dataset.sourceKind === trigger?.dataset.sourceKind && button.getClientRects().length)?.focus());
    },
  });
  dialog = content.closest('.modal'); dialog.addEventListener('keydown', trapFocus);
  effect.focus(); refresh();
}
