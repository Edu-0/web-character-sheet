// tabs.js
// Navegação entre seções (abas) da ficha, acessível via teclado.
export function initTabs(root = document) {
  const tabList = root.querySelector('[role="tablist"]');
  if (!tabList) return;
  const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((tab) => root.getElementById(tab.getAttribute('aria-controls')));

  function activate(index, { focus = true } = {}) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i]?.toggleAttribute('hidden', !selected);
    });
    if (focus) tabs[index].focus();
    localStorage.setItem('ficha-rpg:last-tab', tabs[index].id);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index, { focus: false }));
    tab.addEventListener('keydown', (e) => {
      let newIndex = null;
      if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
      if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') newIndex = 0;
      if (e.key === 'End') newIndex = tabs.length - 1;
      if (newIndex !== null) {
        e.preventDefault();
        activate(newIndex);
      }
    });
  });

  const lastTabId = localStorage.getItem('ficha-rpg:last-tab');
  const restoreIndex = tabs.findIndex((t) => t.id === lastTabId);
  activate(restoreIndex >= 0 ? restoreIndex : 0, { focus: false });
}
