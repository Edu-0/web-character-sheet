// app.js
// Ponto de entrada: inicializa módulos e conecta eventos da interface ao estado.
import { state, createDefaultCharacter } from './state.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import { initTabs } from './tabs.js';
import { initTheme, applyTheme, getAvailableThemes } from './theme.js';
import { notify } from './notifications.js';
import { confirmDialog } from './modal.js';
import { roll, getHistory } from './dice.js';
import { loadSystem, getDiceSet } from './engine/system.js';
import { loadLayout } from './engine/layout.js';
import { getAppState, setAppState, updateAppState, subscribeAppState } from './app-state.js';

const $ = (id) => document.getElementById(id);

async function init() {
  initTheme();

  // System.json define as regras (atributos, perícias, dados, fórmulas) — precisa
  // estar carregado antes de qualquer personagem ser criado ou renderizado.
  const system = await loadSystem('./data/systems/dnd2024.system.json');

  try {
    // Layout.json ainda é apenas descritivo nesta versão: documenta a organização
    // visual da ficha, mas a interface abaixo continua desenhada por ui.js/index.html.
    // Um renderer genérico (engine/renderer.js) já existe e é usado pelo test-engine.html.
    await loadLayout('./data/systems/dnd2024.layout.json');
  } catch (err) {
    console.warn('Layout descritivo não carregado (não afeta a ficha atual):', err);
  }

  initShell();
  initTabs(document, {
    initialTabId: getAppState().ui.activeTab,
    onChange: (tabId) => setAppState('ui.activeTab', tabId),
  });
  ui.mountStaticIcons();
  ui.initGenericBindings();

  const saved = storage.loadCharacter();
  state.load(saved || createDefaultCharacter());

  updateAppState({
    currentSystem: { id: system.id, name: system.name },
    currentCharacter: characterSummary(state.get()),
    availableSystems: [{ id: system.id, name: system.name }],
    availableCharacters: [characterSummary(state.get())],
  });

  ui.renderAll(state.get());
  buildDiceButtons();
  renderDiceHistory();

  state.subscribe((character) => {
    ui.refreshComputedOnly(character);
    ui.updatePortrait(character);
    storage.saveCharacter(character);
    showSaved();
    const summary = characterSummary(character);
    updateAppState({ currentCharacter: summary, availableCharacters: [summary] });
  });

  wireToolbar();
  wirePortrait();
  wireAddButtons();
  wireInventorySearch();
  wireDiceTray();
}

function characterSummary(character) {
  return {
    id: character.meta?.id ?? null,
    system: character.meta?.system ?? null,
    name: character.identity?.name?.trim() || 'Sem nome',
  };
}

function initShell() {
  document.querySelectorAll('[data-app-view-target]').forEach((button) => {
    button.addEventListener('click', () => setAppState('currentView', button.dataset.appViewTarget));
  });

  subscribeAppState(renderShell);
  renderShell(getAppState());
}

function renderShell(appState) {
  document.querySelectorAll('[data-app-view]').forEach((view) => {
    view.toggleAttribute('hidden', view.dataset.appView !== appState.currentView);
  });

  document.querySelectorAll('.shell-nav [data-app-view-target]').forEach((button) => {
    const active = button.dataset.appViewTarget === appState.currentView;
    button.classList.toggle('shell-nav__item--active', active);
    button.toggleAttribute('aria-current', active);
  });

  const systemName = appState.currentSystem?.name || 'Nenhum sistema';
  const characterName = appState.currentCharacter?.name || 'Sem personagem';
  $('shell-current-system').textContent = systemName;
  $('shell-current-character').textContent = characterName;
}

let saveIndicatorTimeout = null;
function showSaved() {
  const el = $('save-indicator');
  el.textContent = 'Salvando...';
  clearTimeout(saveIndicatorTimeout);
  saveIndicatorTimeout = setTimeout(() => {
    el.textContent = 'Salvo';
  }, 350);
}

function wireToolbar() {
  $('btn-theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const themes = getAvailableThemes().map((t) => t.key);
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    applyTheme(next);
  });

  $('btn-new-character').addEventListener('click', async () => {
    const ok = await confirmDialog('Criar um novo personagem? Isso substituirá a ficha atual (o personagem atual não será salvo em arquivo).', { title: 'Novo personagem', confirmLabel: 'Criar novo' });
    if (!ok) return;
    state.load(createDefaultCharacter());
    ui.renderAll(state.get());
    notify('Novo personagem criado.');
  });

  $('btn-clear-character').addEventListener('click', async () => {
    const ok = await confirmDialog('Isso apagará todos os dados salvos localmente e não pode ser desfeito.', { title: 'Limpar ficha', confirmLabel: 'Apagar tudo' });
    if (!ok) return;
    storage.clearCharacter();
    state.load(createDefaultCharacter());
    ui.renderAll(state.get());
    notify('Ficha limpa.');
  });

  $('btn-export').addEventListener('click', () => {
    storage.exportCharacterToFile(state.get());
    notify('Personagem exportado.');
  });

  $('btn-import').addEventListener('click', () => $('input-import-file').click());
  $('input-import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await storage.importCharacterFromFile(file);
      state.load(data);
      ui.renderAll(state.get());
      notify('Personagem importado com sucesso.');
    } catch (err) {
      notify(err.message, { type: 'error' });
    } finally {
      e.target.value = '';
    }
  });

  $('btn-print').addEventListener('click', () => window.print());
}

function wirePortrait() {
  $('btn-portrait-upload').addEventListener('click', () => $('input-portrait-file').click());
  $('input-portrait-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await storage.readImageAsDataUrl(file);
      state.setPath('identity.portrait', dataUrl);
    } catch (err) {
      notify(err.message, { type: 'error' });
    } finally {
      e.target.value = '';
    }
  });
  $('btn-portrait-remove').addEventListener('click', async () => {
    if (!state.get().identity.portrait) return;
    const ok = await confirmDialog('Remover o retrato do personagem?', { title: 'Remover retrato' });
    if (ok) state.setPath('identity.portrait', null);
  });
}

function wireAddButtons() {
  $('btn-add-attack').addEventListener('click', () => {
    state.addItem('combat.attacks', { name: '', bonus: '', damage: '', damageType: '', range: '', properties: '', notes: '' });
    ui.buildAttacks(state.get());
  });

  $('btn-add-feature').addEventListener('click', () => {
    state.addItem('features', { name: '', source: 'Classe', usesCurrent: 0, usesMax: 0, description: '', notes: '' });
    ui.buildFeatures(state.get());
  });

  $('btn-add-spell').addEventListener('click', () => {
    state.addItem('spellcasting.spells', { name: '', level: 0, school: '', prepared: false, castingTime: '', range: '', duration: '', components: '', description: '' });
    ui.buildSpells(state.get());
  });

  $('btn-add-item').addEventListener('click', () => {
    state.addItem('inventory.items', { name: '', qty: 1, weight: 0, value: 0, category: 'Equipamento', equipped: false, notes: '' });
    ui.buildInventory(state.get());
  });
}

function wireInventorySearch() {
  $('inventory-search').addEventListener('input', (e) => {
    ui.setInventoryFilter(e.target.value);
  });
}

function wireDiceTray() {
  const toggle = $('btn-dice-toggle');
  const panel = $('dice-panel');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
}

function buildDiceButtons() {
  const container = $('dice-buttons');
  container.innerHTML = '';
  getDiceSet().forEach((sides) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dice-button';
    btn.textContent = `d${sides}`;
    btn.addEventListener('click', () => {
      const result = roll({ sides, count: 1, modifier: 0, label: `d${sides}` });
      $('dice-result').textContent = `${result.formula} = ${result.total}`;
      renderDiceHistory();
    });
    container.appendChild(btn);
  });
}

function renderDiceHistory() {
  const list = $('dice-history');
  list.innerHTML = '';
  getHistory().forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'dice-history__entry';
    li.textContent = `${entry.formula} → ${entry.rolls.join(', ')} = ${entry.total}`;
    list.appendChild(li);
  });
}

init().catch((err) => {
  console.error(err);
  notify(`Erro ao iniciar a ficha: ${err.message}`, { type: 'error', duration: 8000 });
});
