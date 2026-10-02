import { readRaw, tryWriteJson } from './persistence.js';
// tabs.js
// Navegação entre seções (abas) da ficha, acessível via teclado.
export function initTabs(root = document, { initialTabId = null, onChange } = {}) {
  const tabList = root.querySelector('[role="tablist"]');
  if (!tabList) return { activate: () => {}, destroy: () => {} };
  const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
  const ownerDocument = root.ownerDocument || root;
  const panels = tabs.map((tab) => ownerDocument.getElementById(tab.getAttribute('aria-controls')));
  const cleanups = [];

  function activate(index, { focus = true } = {}) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i]?.toggleAttribute('hidden', !selected);
    });
    if (focus) tabs[index].focus();
    tryWriteJson('ficha-rpg:last-tab', tabs[index].id);
    onChange?.(tabs[index].id.replace(/^tab-/, ''));
  }

  tabs.forEach((tab, index) => {
    const onClick = () => activate(index, { focus: false });
    const onKeydown = (e) => {
      let newIndex = null;
      if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
      if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') newIndex = 0;
      if (e.key === 'End') newIndex = tabs.length - 1;
      if (newIndex !== null) {
        e.preventDefault();
        activate(newIndex);
      }
    };
    tab.addEventListener('click', onClick);
    tab.addEventListener('keydown', onKeydown);
    cleanups.push(() => {
      tab.removeEventListener('click', onClick);
      tab.removeEventListener('keydown', onKeydown);
    });
  });

  let lastTabId;
  try { const raw = readRaw('ficha-rpg:last-tab'); lastTabId = raw?.startsWith('\"') ? JSON.parse(raw) : raw; } catch { lastTabId = null; }
  const requestedId = initialTabId ? `tab-${initialTabId}` : lastTabId;
  const restoreIndex = tabs.findIndex((t) => t.id === requestedId);
  activate(restoreIndex >= 0 ? restoreIndex : 0, { focus: false });

  return {
    activate(tabId, options) {
      const normalized = tabId.startsWith('tab-') ? tabId : `tab-${tabId}`;
      const index = tabs.findIndex((tab) => tab.id === normalized);
      if (index >= 0) activate(index, options);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
