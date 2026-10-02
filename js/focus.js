export function captureFocus(root) {
  const active = document.activeElement;
  if (!root.contains(active)) return () => {};
  const component = active.closest('[data-search-key], .engine-component');
  const entry = active.closest('[data-entry-id]');
  const entryOpen = entry?.matches('details') && entry.open;
  const itemField = active.closest('[data-item-field]')?.dataset.itemField;
  const controls = [...(itemField ? active.closest('[data-item-field]') : entry || component || root).querySelectorAll('input, textarea, select, button')];
  const index = controls.indexOf(active);
  const identity = { searchKey: component?.dataset.searchKey, field: component?.dataset.field, entry: entry?.dataset.entryId };
  const selection = typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const scroll = [window.scrollX, window.scrollY];
  return () => {
    const nextComponent = [...root.querySelectorAll('.engine-component')].find(node => identity.searchKey ? node.dataset.searchKey === identity.searchKey : node.dataset.field === identity.field) || (!component || !root.contains(component) ? root : null);
    if (!nextComponent) return;
    const nextEntry = identity.entry ? [...nextComponent.querySelectorAll('[data-entry-id]')].find(node => node.dataset.entryId === identity.entry) : nextComponent;
    if (!nextEntry) return;
    if (entryOpen && nextEntry.matches('details')) nextEntry.open = true;
    const group = itemField ? [...nextEntry.querySelectorAll('[data-item-field]')].find(node => node.dataset.itemField === itemField) : nextEntry;
    const target = group?.querySelectorAll('input, textarea, select, button')[index];
    if (!target || target.disabled || !target.getClientRects().length) return;
    target.focus({ preventScroll: true });
    if (selection && typeof target.selectionStart === 'number') target.setSelectionRange(...selection);
    window.scrollTo(...scroll);
  };
}
