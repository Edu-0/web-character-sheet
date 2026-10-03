import { state } from './state.js';
import { notify } from './notifications.js';

export function initCharacterHistoryControls({ isAvailable, validate }) {
  const undo = document.getElementById('btn-undo-edit'), redo = document.getElementById('btn-redo-edit');
  const status = document.getElementById('edit-history-status');
  const inputIds = new WeakMap(); let nextInputId = 0, nextEventId = 0;
  const modalIsOpen = () => Boolean(document.querySelector('dialog[open], .modal-overlay:not([hidden])'));
  const refresh = () => {
    const history = state.historyStatus(), available = isAvailable();
    undo.disabled = !available || !history.undo; redo.disabled = !available || !history.redo;
    undo.title = history.undo ? `Desfazer: ${history.undo} (Ctrl/⌘ Z)` : 'Desfazer edição desta sessão (Ctrl/⌘ Z)';
    redo.title = history.redo ? `Refazer: ${history.redo} (Ctrl/⌘ Shift Z)` : 'Refazer edição desta sessão (Ctrl/⌘ Shift Z)';
    status.textContent = `${history.undoCount} operação(ões) para desfazer; ${history.redoCount} para refazer. Histórico desta sessão.`;
  };
  const apply = direction => {
    if (!isAvailable() || modalIsOpen()) return;
    try { state.replayHistory(direction, validate); } catch (error) { notify(error.message, { type: 'error' }); }
    refresh();
  };
  undo.addEventListener('click', () => apply('undo'));
  redo.addEventListener('click', () => apply('redo'));
  state.subscribeHistory(refresh);

  const editSurface = target => target instanceof Element && target.closest('#generic-sheet-host, #legacy-dnd-sheet, dialog, .modal');
  const contextForEvent = event => {
    if (!editSurface(event.target)) { state.historyContext = null; state.history.breakGroup(); return; }
    const control = event.target.closest('input, textarea, select, button');
    if (!control) { state.historyContext = null; state.history.breakGroup(); return; }
    const typing = event.type === 'input' && (control.matches('textarea') || control.matches('input:not([type="checkbox"]):not([type="file"]):not([type="search"])'));
    if (!inputIds.has(control)) inputIds.set(control, ++nextInputId);
    const label = (control.getAttribute('aria-label') || control.labels?.[0]?.querySelector('span')?.textContent || control.labels?.[0]?.textContent || control.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const context = { group: typing ? `input-${inputIds.get(control)}` : `event-${++nextEventId}`,
      label: label ? `${control.matches('button') ? '' : 'Alterar '}${label}` : 'Editar ficha' };
    state.historyContext = context;
    // O navegador pode executar microtasks entre os listeners de captura e de destino.
    // Mantém o contexto até terminar o evento, incluindo notificações múltiplas da mesma ação.
    setTimeout(() => { if (state.historyContext === context) state.historyContext = null; }, 0);
  };
  for (const name of ['input', 'change', 'click']) document.addEventListener(name, contextForEvent, true);
  document.addEventListener('focusout', event => { if (editSurface(event.target)) state.history.breakGroup(); });
  document.addEventListener('keydown', event => {
    if (!isAvailable() || event.defaultPrevented || event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey || modalIsOpen()) return;
    if (event.target instanceof Element && event.target.closest('#sheet-search-input, #dice-tray, [data-app-view="settings"], [data-app-view="systems"], [data-app-view="characters"]')) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && !(key === 'y' && event.ctrlKey && !event.shiftKey)) return;
    event.preventDefault(); apply(key === 'y' || event.shiftKey ? 'redo' : 'undo');
  });
  refresh();
  return { refresh };
}
