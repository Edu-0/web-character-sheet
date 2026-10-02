import { initBackupControls } from './backup-controls.js';
import { captureFocus } from './focus.js';
import { recoverTransactions, reportStorageError } from './persistence.js';
import { assertValid, validateCharacterForPackage } from './validation/schemas.js';
// app.js — shell global, bibliotecas e apresentações da ficha ativa.
import { state } from './state.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as characters from './repositories/character-repository.js';
import {
  exportSystemPackage,
  getSystemPackage,
  hasSystem,
  importSystemPackage,
  initSystemRepository,
  listSystems,
} from './repositories/system-repository.js';
import { initTabs } from './tabs.js';
import { initTheme, applyTheme, getAvailableThemes } from './theme.js';
import { notify } from './notifications.js';
import { confirmDialog } from './modal.js';
import { roll, getHistory, clearHistory } from './dice.js';
import { setSystem, getDiceSet } from './engine/system.js';
import { setLayout } from './engine/layout.js';
import { renderSheet } from './engine/renderer.js';
import './systems/dnd2024-fields.js';
import { getAppState, setAppState, updateAppState, subscribeAppState } from './app-state.js';
import { initAppearanceControls } from './appearance.js';
import { initSheetSearch } from './sheet-search.js';
import { buildSearchIndex } from './engine/search.js';
import { revealDndSearchResult } from './systems/dnd2024-search.js';
import { initArtworkControls, applyArtworkPreferences } from './artwork.js';
import { createDiceLabel } from './dice-display.js';
import { initPrinting } from './printing.js';
import { initShellActions } from './shell-actions.js';

const $ = (id) => document.getElementById(id);
const DND_SYSTEM_ID = 'dnd2024';

let activePackage = null;
let activeCharacterId = null;
let saveTimeout = null;
let unsavedCharacter = false;
let suppressCharacterEffects = false;
let appPersistenceEnabled = false;
let genericSheetController = null;
let legacyTabsController = null;
let engineChangeInProgress = false;
let synchronizingTabs = false;
let mountingGenericSheet = false;
let sheetSearch = null;

async function init() {
  try { recoverTransactions(); } catch { /* adapter mantém bloqueio e journal para recuperação */ }
  const session = storage.loadAppSession();
  if (session.activeTab) setAppState('ui.activeTab', session.activeTab);
  if (['legacy', 'engine', 'compare'].includes(session.dndPresentation)) {
    setAppState('ui.dndPresentation', session.dndPresentation);
  }
  initTheme();
  initAppearanceControls();
  initArtworkControls();
  initShell();
  initShellActions();
  initBackupControls({
    getCurrentCharacter: () => activeCharacterId ? state.get() : null,
    onRestored: async () => {
      clearTimeout(saveTimeout); saveTimeout = null; unsavedCharacter = false;
      const previousId = activeCharacterId;
      activeCharacterId = null;
      refreshLibraries();
      initTheme();
      applyArtworkPreferences();
      const available = characters.listCharacters().filter(character => hasSystem(character.system));
      const next = available.find(character => character.id === previousId) || available[0];
      if (next) await openCharacter(next.id, {view: 'settings'});
      else {
        genericSheetController?.destroy(); genericSheetController = null;
        await activateSystem(DND_SYSTEM_ID);
        updateAppState({currentCharacter: null, currentSystem: systemSummary(activePackage.system), currentView: 'characters'});
      }
      $('save-indicator').textContent = 'Salvo';
    },
  });
  initLegacyControls(session.activeTab);
  initPrinting(() => activePackage && getAppState().currentCharacter ? {
    layout: activePackage.layouts[0], system: activePackage.system, character: state.get(),
  } : null);
  sheetSearch = initSheetSearch({
    getIndex: () => activeCharacterId && activePackage ? buildSearchIndex(activePackage.layouts[0], state.get(), activePackage.system) : [],
    onShortcut: () => setAppState('currentView', 'sheet'),
    onNavigate: (entry) => {
      if (!activeCharacterId || !getAppState().currentCharacter) return;
      if (activePackage?.system.id === DND_SYSTEM_ID && getAppState().ui.dndPresentation === 'legacy') revealDndSearchResult(entry, state.get(), legacyTabsController);
      else genericSheetController?.revealSearchResult(entry);
    },
  });
  await initSystemRepository();

  state.subscribe(onCharacterChange);
  refreshLibraries();

  const savedCharacter = session.currentCharacterId && characters.getCharacter(session.currentCharacterId);
  if (savedCharacter && hasSystem(savedCharacter.meta.system)) {
    await openCharacter(savedCharacter.meta.id, { view: session.currentView || 'sheet' });
  } else {
    const firstAvailable = characters.listCharacters().find((entry) => hasSystem(entry.system));
    if (firstAvailable) await openCharacter(firstAvailable.id, { view: session.currentView || 'sheet' });
    else await createAndOpenCharacter(session.currentSystemId && hasSystem(session.currentSystemId) ? session.currentSystemId : DND_SYSTEM_ID, { notifyUser: false });
  }
  appPersistenceEnabled = true;
  persistAppState(getAppState());
}

function initLegacyControls(initialTabId) {
  legacyTabsController = initTabs($('legacy-dnd-sheet'), {
    initialTabId,
    onChange: (tabId) => {
      if (activePackage?.system.id !== DND_SYSTEM_ID || synchronizingTabs) return;
      setAppState('ui.activeTab', tabId);
      synchronizingTabs = true;
      try { genericSheetController?.activate(tabId, { focus: false }); }
      finally { synchronizingTabs = false; }
    },
  });
  ui.mountStaticIcons();
  ui.initGenericBindings();
  wireToolbar();
  wirePortrait();
  wireAddButtons();
  wireInventorySearch();
  wireDiceTray();
  document.querySelectorAll('[data-dnd-presentation]').forEach((button) => {
    button.addEventListener('click', () => setAppState('ui.dndPresentation', button.dataset.dndPresentation));
  });
}

function initShell() {
  document.querySelectorAll('[data-app-view-target]').forEach((button) => {
    button.addEventListener('click', () => setAppState('currentView', button.dataset.appViewTarget));
  });

  subscribeAppState((appState) => {
    renderShell(appState);
    if (appPersistenceEnabled) persistAppState(appState);
  });
  renderShell(getAppState());
}

function renderShell(appState) {
  document.querySelectorAll('[data-app-view]').forEach((view) => {
    view.toggleAttribute('hidden', view.dataset.appView !== appState.currentView);
  });

  document.querySelectorAll('.shell-nav [data-app-view-target]').forEach((button) => {
    const active = button.dataset.appViewTarget === appState.currentView;
    button.classList.toggle('shell-nav__item--active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  $('shell-current-system').textContent = appState.currentSystem?.name || 'Nenhum sistema';
  $('shell-current-character').textContent = appState.currentCharacter?.name || 'Sem personagem';
  $('sheet-heading-system').textContent = appState.currentSystem?.name || '';
  $('sheet-heading-name').textContent = appState.currentCharacter?.name || 'Sem personagem';
  $('sheet-heading').dataset.variant = activePackage?.layouts[0]?.variant || '';
  $('btn-clear-character').disabled = !appState.currentCharacter;
  $('btn-save-character').disabled = !appState.currentCharacter;
  $('btn-export').disabled = !appState.currentCharacter;
  $('sheet-search-input').disabled = !appState.currentCharacter;
  if (!appState.currentCharacter) sheetSearch?.reset();
  updateSheetPresentation();
}

async function activateSystem(systemId) {
  const pkg = await getSystemPackage(systemId);
  useSystemPackage(pkg);
  return pkg;
}

function useSystemPackage(pkg) {
  activePackage = pkg;
  setSystem(pkg.system);
  setLayout(pkg.layouts[0] ?? null);
}

async function openCharacter(id, { view = 'sheet' } = {}) {
  flushCharacterSave();
  const character = characters.getCharacter(id);
  if (!character) throw new Error('Personagem não encontrado.');
  if (!hasSystem(character.meta.system)) {
    notify(`O sistema "${character.meta.system}" não está disponível.`, { type: 'error' });
    setAppState('currentView', 'characters');
    return;
  }

  const pkg = await getSystemPackage(character.meta.system);
  assertValid(character, value => validateCharacterForPackage(value, pkg), 'personagem');
  useSystemPackage(pkg);
  activeCharacterId = character.meta.id;
  suppressCharacterEffects = true;
  state.load(character);
  suppressCharacterEffects = false;

  updateAppState({
    currentSystem: systemSummary(pkg.system),
    currentCharacter: characterSummary(character),
    currentView: view,
  });
  mountActiveSheet(character);
  refreshLibraries();
}

async function openSystem(systemId) {
  const existing = characters.listCharacters().find((character) => character.system === systemId);
  if (existing) await openCharacter(existing.id);
  else await createAndOpenCharacter(systemId);
}

async function createAndOpenCharacter(systemId, { notifyUser = true } = {}) {
  flushCharacterSave();
  const pkg = await activateSystem(systemId);
  const character = characters.createCharacter(pkg.system);
  await openCharacter(character.meta.id);
  if (notifyUser) notify(`Novo personagem criado para ${pkg.system.name}.`);
}

function mountActiveSheet(character) {
  sheetSearch?.reset();
  const isDnd = activePackage?.system.id === DND_SYSTEM_ID;
  genericSheetController?.destroy();
  genericSheetController = null;

  clearHistory();
  if (isDnd) {
    ui.renderAll(character);
    buildDiceButtons();
    renderDiceHistory();
    if (getAppState().ui.dndPresentation !== 'legacy') renderGenericSheet(character);
  } else {
    renderGenericSheet(character);
  }
  updateSheetPresentation();
}

function updateSheetPresentation() {
  if (!activePackage) return;
  const isDnd = activePackage.system.id === DND_SYSTEM_ID;
  const presentation = getAppState().ui.dndPresentation;
  const compare = isDnd && presentation === 'compare';
  $('dnd-presentation-controls').hidden = !isDnd;
  $('legacy-dnd-sheet').hidden = !isDnd || presentation === 'engine';
  $('generic-sheet-host').hidden = isDnd && presentation === 'legacy';
  $('dice-tray').hidden = !isDnd;
  $('dnd-sheet-surfaces').classList.toggle('dnd-sheet-surfaces--compare', compare);
  document.querySelectorAll('[data-dnd-presentation]').forEach((button) => {
    const active = button.dataset.dndPresentation === presentation;
    button.classList.toggle('dnd-presentation__button--active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (isDnd && presentation === 'legacy' && genericSheetController) {
    genericSheetController.destroy();
    genericSheetController = null;
  }
  if (isDnd && presentation !== 'legacy' && !genericSheetController && !mountingGenericSheet) renderGenericSheet(state.get());
}

function renderGenericSheet(character) {
  const host = $('generic-sheet-host');
  mountingGenericSheet = true;
  try {
    genericSheetController = renderSheet(host, activePackage.layouts[0], character, {
      showHeader: false,
      system: activePackage.system,
      initialTabId: getAppState().ui.activeTab,
      onTabChange: (tabId) => {
        if (activePackage?.system.id === DND_SYSTEM_ID && !synchronizingTabs) {
          synchronizingTabs = true;
          try { legacyTabsController?.activate(tabId, { focus: false }); }
          finally { synchronizingTabs = false; }
        }
        if (getAppState().ui.activeTab !== tabId) setAppState('ui.activeTab', tabId);
      },
      onChange: () => {
        engineChangeInProgress = true;
        try { state.notify(); } finally { engineChangeInProgress = false; }
      },
    });
  } finally {
    mountingGenericSheet = false;
  }
}

function onCharacterChange(character) {
  if (suppressCharacterEffects || !activeCharacterId || character.meta?.id !== activeCharacterId) return;
  if (activePackage?.system.id === DND_SYSTEM_ID) {
    if (engineChangeInProgress) ui.renderAll(character);
    else {
      ui.refreshComputedOnly(character);
      ui.updatePortrait(character);
      if (genericSheetController && getAppState().ui.dndPresentation !== 'legacy') {
        const restoreFocus = captureFocus($('generic-sheet-host'));
        genericSheetController.destroy();
        genericSheetController = null;
        renderGenericSheet(character);
        restoreFocus();
      }
    }
  }
  scheduleCharacterSave(character);
  sheetSearch?.refresh();
  updateAppState({ currentCharacter: characterSummary(character) });
}

function scheduleCharacterSave(character) {
  $('save-indicator').textContent = 'Salvando...';
  clearTimeout(saveTimeout);
  const snapshot = structuredClone(character);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      const saved = characters.saveCharacter(snapshot);
      unsavedCharacter = false;
      refreshLibraries();
      updateAppState({ currentCharacter: characterSummary(saved) });
      $('save-indicator').textContent = 'Salvo';
    } catch (error) { unsavedCharacter = true; $('save-indicator').textContent = 'Não salvo — exporte seus dados'; reportStorageError(error); }
  }, 300);
}

function flushCharacterSave({ force = false } = {}) {
  if ((!saveTimeout && !force && !unsavedCharacter) || !activeCharacterId) return;
  clearTimeout(saveTimeout);
  saveTimeout = null;
  const current = state.get();
  try {
    if (current.meta?.id === activeCharacterId) characters.saveCharacter(current);
    unsavedCharacter = false;
    $('save-indicator').textContent = 'Salvo';
  } catch (error) { unsavedCharacter = true; $('save-indicator').textContent = 'Não salvo — exporte seus dados'; throw error; }
}

function refreshLibraries() {
  const systems = listSystems();
  const characterList = characters.listCharacters();
  updateAppState({ availableSystems: systems, availableCharacters: characterList });
  renderSystemLibrary(systems);
  renderCharacterLibrary(characterList);
}

function renderSystemLibrary(systems) {
  const container = $('systems-list');
  container.innerHTML = '';
  systems.forEach((system) => {
    const card = element('article', `library-card${activePackage?.system.id === system.id ? ' library-card--current' : ''}`);
    const header = element('div', 'library-card__header');
    header.append(
      element('h2', 'library-card__title', system.name),
      element('span', 'library-card__badge', system.source === 'builtin' ? 'Embutido' : 'Importado'),
    );
    const actions = element('div', 'library-card__actions');
    actions.append(
      actionButton('Abrir', 'button button--primary', () => runAction(() => openSystem(system.id))),
      actionButton('Exportar', 'button button--ghost', () => runAction(async () => {
        storage.downloadJson(await exportSystemPackage(system.id), `${system.id}.system.json`);
      })),
    );
    card.append(header, element('p', 'library-card__meta', `${system.layoutCount} layout(s) disponível(is)`), actions);
    container.appendChild(card);
  });
}

function renderCharacterLibrary(characterList) {
  const container = $('characters-list');
  container.innerHTML = '';
  if (characterList.length === 0) {
    container.appendChild(element('p', 'library-empty', 'Nenhum personagem salvo. Crie o primeiro personagem para o sistema atual.'));
    return;
  }

  const systemsById = new Map(listSystems().map((system) => [system.id, system]));
  characterList.forEach((character) => {
    const system = systemsById.get(character.system);
    const card = element('article', `library-card${activeCharacterId === character.id ? ' library-card--current' : ''}`);
    const header = element('div', 'library-card__header');
    header.append(element('h2', 'library-card__title', character.name), element('span', 'library-card__badge', system?.name || character.system));
    card.append(header, element('p', 'library-card__meta', `Atualizado em ${formatDate(character.updatedAt)}`));
    if (!system) card.appendChild(element('p', 'library-card__warning', 'O sistema deste personagem não está disponível.'));

    const actions = element('div', 'library-card__actions');
    const openButton = actionButton('Abrir', 'button button--primary', () => runAction(() => openCharacter(character.id)));
    openButton.disabled = !system;
    actions.append(
      openButton,
      actionButton('Duplicar', 'button button--ghost', () => runAction(async () => {
        const copy = characters.duplicateCharacter(character.id);
        refreshLibraries();
        await openCharacter(copy.meta.id);
      })),
      actionButton('Exportar', 'button button--ghost', () => {
        const exported = characters.exportCharacter(characters.getCharacter(character.id));
        storage.downloadJson(exported.data, exported.filename);
      }),
      actionButton('Excluir', 'button button--danger', () => runAction(() => deleteCharacter(character.id, character.name))),
    );
    card.appendChild(actions);
    container.appendChild(card);
  });
}

async function deleteCharacter(id, name) {
  const ok = await confirmDialog(`Excluir "${name}" permanentemente?`, { title: 'Excluir personagem', confirmLabel: 'Excluir' });
  if (!ok) return;
  if (id === activeCharacterId) {
    flushCharacterSave();
    activeCharacterId = null;
    updateAppState({ currentCharacter: null, currentView: 'characters' });
  }
  characters.removeCharacter(id);
  refreshLibraries();
  notify('Personagem excluído.');
}

function wireToolbar() {
  $('btn-theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const themes = getAvailableThemes().map((theme) => theme.key);
    applyTheme(themes[(themes.indexOf(current) + 1) % themes.length]);
  });

  const createCurrent = () => runAction(() => createAndOpenCharacter(activePackage?.system.id || DND_SYSTEM_ID));
  $('btn-new-character').addEventListener('click', createCurrent);
  $('btn-library-new-character').addEventListener('click', createCurrent);

  $('btn-clear-character').addEventListener('click', () => runAction(async () => {
    if (!activePackage || !activeCharacterId) return;
    const ok = await confirmDialog('Restaurar todos os campos deste personagem para os valores iniciais do sistema?', { title: 'Limpar ficha', confirmLabel: 'Limpar' });
    if (!ok) return;
    const reset = structuredClone(activePackage.system.characterTemplate);
    reset.meta = { ...reset.meta, ...state.get().meta, updatedAt: new Date().toISOString() };
    state.load(reset);
    mountActiveSheet(reset);
    notify('Ficha restaurada.');
  }));

  $('btn-save-character').addEventListener('click', () => runAction(() => {
    flushCharacterSave({ force: true });
    refreshLibraries();
    notify('Personagem salvo.');
  }));

  $('btn-export').addEventListener('click', () => {
    if (!activeCharacterId) return;
    try { flushCharacterSave(); } catch (error) { reportStorageError(error); }
    const exported = characters.exportCharacter(state.get());
    storage.downloadJson(exported.data, exported.filename);
    notify('Personagem exportado.');
  });

  $('btn-import').addEventListener('click', () => $('input-import-file').click());
  $('input-import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    await runAction(async () => {
      const character = await characters.importCharacter(file, { validate: async value => {
        if (hasSystem(value.meta.system)) { const pkg = await getSystemPackage(value.meta.system); assertValid(value, item => validateCharacterForPackage(item, pkg), 'personagem'); }
      } });
      refreshLibraries();
      if (hasSystem(character.meta.system)) await openCharacter(character.meta.id);
      else {
        setAppState('currentView', 'characters');
        notify(`Personagem importado, mas o sistema "${character.meta.system}" não está disponível.`, { type: 'error' });
      }
    });
    event.target.value = '';
  });

  $('btn-import-system').addEventListener('click', () => $('input-import-system').click());
  $('input-import-system').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    await runAction(async () => {
      let pkg;
      try { pkg = await importSystemPackage(file); }
      catch (error) {
        if (error.code !== 'system-conflict') throw error;
        if (!await confirmDialog('Substituir este sistema? Personagens existentes serão preservados, mas o novo layout pode ser incompatível.', {title: 'Sistema já existente', confirmLabel: 'Substituir sistema'})) return;
        pkg = await importSystemPackage(file, {replace: true});
      }
      refreshLibraries();
      notify(`Sistema "${pkg.system.name}" importado.`);
    });
    event.target.value = '';
  });

}

function wirePortrait() {
  $('btn-portrait-upload').addEventListener('click', () => $('input-portrait-file').click());
  $('input-portrait-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      state.setPath('identity.portrait', await storage.readImageAsDataUrl(file));
    } catch (error) {
      notify(error.message, { type: 'error' });
    } finally {
      event.target.value = '';
    }
  });
  $('btn-portrait-remove').addEventListener('click', async () => {
    if (!state.get().identity?.portrait) return;
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
  $('inventory-search').addEventListener('input', (event) => ui.setInventoryFilter(event.target.value));
}

function wireDiceTray() {
  const toggle = $('btn-dice-toggle');
  const panel = $('dice-panel');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
  document.addEventListener('dnd:rolled', (event) => {
    const result = event.detail;
    $('dice-result').textContent = `${result.formula} = ${result.total}`;
    renderDiceHistory();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  });
}

function buildDiceButtons() {
  const container = $('dice-buttons');
  container.innerHTML = '';
  getDiceSet().forEach((sides) => {
    const button = actionButton('', 'dice-button', () => {
      const result = roll({ sides, count: 1, modifier: 0, label: `d${sides}` });
      $('dice-result').textContent = `${result.formula} = ${result.total}`;
      renderDiceHistory();
    });
    button.appendChild(createDiceLabel([sides]));
    container.appendChild(button);
  });
}

function renderDiceHistory() {
  const list = $('dice-history');
  list.innerHTML = '';
  getHistory().forEach((entry) => {
    list.appendChild(element('li', 'dice-history__entry', `${entry.formula} → ${entry.rolls.join(', ')} = ${entry.total}`));
  });
}

function characterSummary(character) {
  return {
    id: character.meta?.id ?? null,
    system: character.meta?.system ?? null,
    name: character.identity?.name?.trim() || character.name?.trim() || 'Sem nome',
    updatedAt: character.meta?.updatedAt ?? null,
  };
}

function systemSummary(system) {
  return { id: system.id, name: system.name };
}

function persistAppState(appState) {
  storage.saveAppSession({
    currentSystemId: appState.currentSystem?.id ?? null,
    currentCharacterId: appState.currentCharacter?.id ?? null,
    currentView: appState.currentView,
    activeTab: appState.ui.activeTab,
    dndPresentation: appState.ui.dndPresentation,
  });
}

function formatDate(value) {
  if (!value) return 'data desconhecida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function actionButton(label, className, onClick) {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    notify(error.message, { type: 'error', duration: 6000 });
  }
}

window.addEventListener('beforeunload', event => {
  try { flushCharacterSave(); } catch { event.preventDefault(); event.returnValue = ''; }
});
let lastStorageMessage = ''; let lastStorageWarning = 0;
window.addEventListener('storage:problem', event => {
  const message = event.detail.message;
  if (message !== lastStorageMessage || Date.now() - lastStorageWarning > 10000) { notify(message, {type: 'error', duration: 10000}); lastStorageMessage = message; lastStorageWarning = Date.now(); }
});

init().catch((error) => {
  console.error(error);
  notify(`Erro ao iniciar a aplicação: ${error.message}`, { type: 'error', duration: 8000 });
});
