import { registerFieldType } from './fields.js';
import { getByPath, setByPath } from './paths.js';
import { undoSheetAction } from './assistance.js';
import { recoveryPlan, recoveryDie, applyRecovery } from './recovery.js';
import { openModal } from '../modal.js';

const node = (tag, text = '', className = '') => { const el = document.createElement(tag); el.textContent = text; el.className = className; return el; };
const button = label => { const el = node('button', label, 'button'); el.type = 'button'; return el; };

export function renderRecoveryGroup(container, context) {
  const wrap = node('div', '', 'engine-actions');
  const row = node('div', '', 'engine-budget__actions');
  const status = node('p', '', 'engine-callout'); status.setAttribute('role', 'status');
  const historyField = context.historyField;
  for (const config of getByPath(context.system, context.actionsFrom) || []) {
    const control = button(config.label); control.dataset.recoveryId = config.id;
    control.addEventListener('click', () => openRecoveryPanel(context, config, container)); row.append(control);
  }
  const undo = button('Desfazer recuperação');
  undo.addEventListener('click', () => {
    if (!undoSheetAction(context.character, getByPath(context.character, historyField))) { status.textContent = 'Os recursos mudaram após a recuperação. Ajuste-os manualmente para corrigir.'; return; }
    setByPath(context.character, historyField, null); context.onChange?.(); refresh();
  });
  row.append(undo); wrap.append(row, status); container.append(wrap);
  const refresh = () => {
    const event = getByPath(context.character, historyField);
    undo.hidden = !event?.changes?.length;
    status.hidden = !event;
    status.textContent = event ? `${event.label}: ${event.details.join(' ') || 'Nenhum recurso precisou ser alterado.'}` : '';
  };
  context.registerRefresh?.(refresh); refresh();
}

export function openRecoveryPanel(context, config, container) {
  const sourceScope = container.closest('#generic-sheet-host, #legacy-dnd-sheet') || container;
  const baseline = structuredClone(context.character), rolls = [];
  const content = node('div', '', 'recovery-panel');
  content.append(node('p', config.help || 'Confira os recursos e as condições desta recuperação.'));
  const preview = node('div', '', 'engine-callout'); preview.setAttribute('aria-label', 'Prévia da recuperação'); preview.setAttribute('role', 'status');
  const error = node('p', '', 'source-roll-error'); error.setAttribute('role', 'alert');
  let manual, spend, applied = false;
  if (config.healing) {
    const label = node('label', '', 'field'); manual = node('input'); manual.type = 'number'; manual.min = '0';
    manual.setAttribute('aria-label', 'Recuperação informada por dado'); manual.placeholder = 'Vazio para rolar; inclua o modificador no valor informado';
    label.append(node('span', 'Recuperação informada por dado'), manual);
    spend = button('Gastar um dado');
    spend.addEventListener('click', () => {
      try {
        recoveryPlan({ ...context, character: baseline }, config, rolls);
        const draft = structuredClone(baseline);
        setByPath(draft, config.healing.usedField, getByPath(draft, config.healing.usedField) + rolls.length);
        const value = recoveryDie({ ...context, character: draft }, config, manual.value);
        rolls.push(value); manual.value = ''; refresh();
      } catch (err) { error.textContent = err.message; }
    });
    content.append(label, spend);
  }
  const confirm = node('label', '', 'field field--checkbox'); const checkbox = node('input'); checkbox.type = 'checkbox';
  confirm.append(checkbox, node('span', config.confirmLabel || 'Confirmo que esta recuperação foi concluída e suas condições foram atendidas'));
  content.append(preview, confirm, error);
  const refresh = () => {
    try {
      const plan = recoveryPlan({ ...context, character: baseline }, config, rolls);
      preview.replaceChildren(...(plan.details.length ? plan.details : ['Nenhum recurso precisa ser alterado.']).map(text => node('p', text)));
      if (config.healing) {
        const remaining = getByPath(baseline, config.healing.totalField) - getByPath(baseline, config.healing.usedField) - rolls.length;
        preview.prepend(node('p', `Dados disponíveis: ${remaining} · selecionados: ${rolls.length}.`));
        spend.disabled = applied || remaining <= 0;
      }
      error.textContent = '';
    } catch (err) { error.textContent = err.message; if (spend) spend.disabled = true; }
  };
  let dialog;
  const trap = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, input')].filter(el => !el.disabled && el.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  };
  const cleanup = () => {
    dialog.removeEventListener('keydown', trap);
    queueMicrotask(() => [...sourceScope.querySelectorAll('[data-recovery-id]')].find(control => control.dataset.recoveryId === config.id)?.focus());
  };
  openModal({ title: config.label, contentEl: content, actions: [
    { label: 'Cancelar', className: 'button button--ghost', onClick: cleanup },
    { label: 'Aplicar recuperação', className: 'button button--primary', closeOnClick: false, onClick: () => {
      try {
        if (applied) return;
        if (!checkbox.checked) throw new Error('Confirme as condições antes de aplicar.');
        const event = applyRecovery(context, config, rolls, baseline);
        setByPath(context.character, context.historyField, event); applied = true;
        context.onChange?.(); refresh();
        content.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
        preview.prepend(node('strong', 'Recuperação aplicada.'));
        dialog.querySelector('.button--primary').disabled = true;
        dialog.querySelector('.button--ghost').textContent = 'Fechar';
      } catch (err) { error.textContent = err.message; }
    } },
  ], onClose: cleanup });
  dialog = content.closest('.modal'); dialog.addEventListener('keydown', trap); refresh();
}

registerFieldType('recoveryGroup', {
  render: renderRecoveryGroup,
  search(context) { return (getByPath(context.system, context.actionsFrom) || []).map(config => ({ label: config.label, value: config.help || 'Recuperação assistida', actionLabel: config.label })); },
  revealSearchResult(wrapper, entry) { return [...wrapper.querySelectorAll('button')].find(control => control.textContent === entry.actionLabel) || wrapper; },
  print() { return null; },
});
