import { normalizeSearch, searchEntries } from './engine/search.js';

export function initSheetSearch({ getIndex, onNavigate, onShortcut }) {
  const input = document.getElementById('sheet-search-input');
  const panel = document.getElementById('sheet-search-results');
  const list = document.getElementById('sheet-search-list');
  const status = document.getElementById('sheet-search-status');
  const clear = document.getElementById('sheet-search-clear');
  let matches = [];

  function close() { panel.hidden = true; }
  function navigate(entry) { close(); onNavigate(entry); }
  function refresh() {
    clear.hidden = !input.value;
    if (!input.value.trim()) { close(); matches = []; status.textContent = ''; list.replaceChildren(); return; }
    const focusedId = document.activeElement?.dataset.searchResult;
    matches = searchEntries(getIndex(), input.value);
    list.replaceChildren();
    panel.hidden = false;
    status.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}${matches.length > 60 ? ' · mostrando os primeiros 60; refine a busca' : ''}` : 'Nenhum resultado. Tente outro termo.';
    matches.slice(0, 60).forEach((entry) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sheet-search__result';
      button.dataset.searchResult = entry.id;
      for (const [className, value] of [['name', entry.label], ['value', snippet(entry.value, input.value)], ['location', entry.location]]) {
        const span = document.createElement('span');
        span.className = `sheet-search__${className}`;
        span.textContent = value;
        button.appendChild(span);
      }
      button.addEventListener('click', () => navigate(entry));
      item.appendChild(button);
      list.appendChild(item);
    });
    if (focusedId) [...list.querySelectorAll('button')].find((button) => button.dataset.searchResult === focusedId)?.focus({ preventScroll: true });
  }

  input.addEventListener('input', refresh);
  input.addEventListener('focus', () => { if (input.value.trim()) refresh(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && !panel.hidden) { event.preventDefault(); list.querySelector('button')?.focus(); }
    if (event.key === 'Enter' && !panel.hidden && matches[0]) { event.preventDefault(); navigate(matches[0]); }
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
  list.addEventListener('keydown', (event) => {
    const buttons = [...list.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); input.focus(); close(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'ArrowUp' && index === 0) { input.focus(); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      buttons[next]?.focus();
    }
  });
  clear.addEventListener('click', () => { input.value = ''; refresh(); input.focus(); });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault(); onShortcut(); input.focus(); input.select();
    }
  });
  return {
    reset() { input.value = ''; refresh(); },
    refresh() { if (!panel.hidden) refresh(); },
  };
}

function snippet(value, query) {
  if (value.length <= 200) return value;
  const term = normalizeSearch(query).split(' ').find((word) => normalizeSearch(value).includes(word));
  const start = Math.max(0, (term ? normalizeSearch(value).indexOf(term) : 0) - 45);
  return `${start ? '…' : ''}${value.slice(start, start + 200)}${value.length > start + 200 ? '…' : ''}`;
}
