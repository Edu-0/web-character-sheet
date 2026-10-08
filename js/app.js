import { initCalculationSettings, applyCalculationPreferences } from './calculation-settings.js';
import { initBackupControls } from './backup-controls.js';
import { captureFocus } from './focus.js';
import { recoverTransactions, reportStorageError, migrationCopyChange } from './persistence.js';
import {hasPendingLibraryWrites,flushLibraryWrites} from './write-coordinator.js';
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
  prepareSystemInstallation,
  installSystemPackage,
  reloadImportedSystems,
} from './repositories/system-repository.js';
import { initTabs } from './tabs.js';
import { initTheme, applyTheme, getAvailableThemes } from './theme.js';
import { notify } from './notifications.js';
import { confirmDialog } from './modal.js';
import { roll, rollExpression, getHistory, clearHistory } from './dice.js';
import { setSystem, getDiceSet } from './engine/system.js';
import { setLayout } from './engine/layout.js';
import { renderSheet } from './engine/renderer.js';
import './systems/dnd2024-fields.js';
import { getAppState, setAppState, updateAppState, subscribeAppState } from './app-state.js';
import { initAppearanceControls } from './appearance.js';
import { initSheetSearch } from './sheet-search.js';
import { preferredLayout, rememberLayout, layoutName, printLayout, layoutSearchIndex } from './sheet-layouts.js';
import { revealDndSearchResult } from './systems/dnd2024-search.js';
import { initArtworkControls, applyArtworkPreferences } from './artwork.js';
import { createDiceLabel } from './dice-display.js';
import { initPrinting } from './printing.js';
import { initShellActions } from './shell-actions.js';
import { initCharacterHistoryControls } from './character-history-controls.js';
import { initPwa } from './pwa.js';

const $ = (id) => document.getElementById(id);
const DND_SYSTEM_ID = 'dnd2024';

let activePackage = null;
let activeLayout = null;
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
let characterHistoryControls = null;
let jsonEditor = null;
let characterSavePromise = Promise.resolve();
let characterSaveRevision = 0;
let preserveMountData = false;
let activeCharacterRaw;
let appInitialized=false;

async function openJsonEditor(options = {}) {
  await flushCharacterSave();
  const {JsonEditor}=await import('./editor/editor-ui.js');
  if(options.source?.kind==='file'){
    const {validateText}=await import('./editor/validation.js'),{installedPackageBase}=await import('./repositories/system-repository.js');
    const parsed=validateText(options.text);
    if(parsed.value?.system?.id)options.source={...options.source,systemId:parsed.value.system.id,base:installedPackageBase(parsed.value.system.id)};
  }
  jsonEditor ||= new JsonEditor($('view-editor'),{onExit:view=>{setAppState('currentView',view);document.querySelector(`[data-app-view-target="${view}"]`)?.focus();},onApply:applyEditorPackage});
  setAppState('currentView','editor');
  await jsonEditor.open(options);
}

async function applyEditorPackage(editor) {
  await flushCharacterSave();
  if(activeCharacterId && characters.rawCharacter(activeCharacterId)!==activeCharacterRaw)throw new Error('O personagem ativo mudou em outra aba. Exporte a edição em memória e reabra a ficha antes de aplicar.');
  const session=editor.session,revision=session.revision,layoutId=editor.layout.value,result=session.validate();
  if(result.status!=='ready' || !editor.lastRenderedCurrent)throw new Error('Valide e atualize o ensaio da revisão atual antes de aplicar.');
  const expectedBase=session.source.systemId===result.document.system.id?session.source.base:null;
  const plan=prepareSystemInstallation(result.document,{expectedBase,currentCharacter:state.get()});
  const summary=`${plan.replace?'Substituir':'Instalar'} ${plan.package.system.name} (${plan.package.system.id}), revisão JSON ${revision}. ${plan.linkedIds.length} personagem(ns) vinculado(s); nenhum será migrado. Layouts removidos: ${plan.removedLayouts.join(', ') || 'nenhum'}; se necessário, a seleção usará ${plan.package.layouts[0].id}. ${plan.replace?'O pacote anterior terá cópia recuperável.':''} Avisos: ${plan.warnings.map(issue=>`${issue.path}: ${issue.message}`).join('; ') || 'nenhum'}.`;
  if(!await confirmDialog(summary,{title:'Aplicar pacote local',confirmLabel:'Confirmar aplicação'}))return;
  const assertCurrent=()=>{if(editor.disposed || editor.session!==session || session.revision!==revision || editor.layout.value!==layoutId || !editor.lastRenderedCurrent || session.validate().status!=='ready')throw new Error('A revisão/ensaio mudou durante a confirmação. Revise e confirme novamente.');if(activeCharacterId && characters.rawCharacter(activeCharacterId)!==activeCharacterRaw)throw new Error('O personagem ativo mudou em outra aba. Preserve sua edição e reabra a ficha.');};
  assertCurrent();
  if(JSON.stringify(state.get())!==plan.activeSnapshot)throw new Error('O personagem ativo mudou durante a confirmação. Preserve a edição e tente novamente.');
  await flushCharacterSave();assertCurrent();
  const copies=session.recoveryOriginalText?[migrationCopyChange(`editor:${session.draftId}`,JSON.parse(session.recoveryOriginalText))]:[];
  const pkg=await installSystemPackage(plan,{currentCharacter:state.get(),assertCurrent,copies});
  session.source={kind:'imported',systemId:pkg.system.id,base:structuredClone(pkg)};session.lastApplied={revision,systemId:pkg.system.id,appliedAt:new Date().toISOString()};
  try {refreshInstalledPackage(pkg);editor.applicationStatus.textContent=`Pacote aplicado localmente · revisão ${revision}. Rascunho preservado; abrir a ficha é uma ação separada.`;}
  catch(error){editor.applicationStatus.textContent=`Pacote salvo, ficha não remontada: ${error.message}. Exporte o rascunho e reabra a ficha pela biblioteca. O pacote anterior está na recuperação.`;}
  session.lastSavedRevision=-1;
  try{await editor.saveDraft();}catch(error){editor.applicationStatus.textContent+=` Rascunho não salvo: ${error.message}`;}
}

function refreshInstalledPackage(pkg) {
  refreshLibraries();if(activePackage?.system.id!==pkg.system.id)return;
  const previousLayout=activeLayout.id;
  genericSheetController?.destroy();genericSheetController=null;
  activePackage=pkg;activeLayout=pkg.layouts.find(layout=>layout.id===previousLayout)||preferredLayout(pkg);preserveMountData=true;
  setSystem(pkg.system);setLayout(activeLayout);renderLayoutControls();
  state.clearHistory();
  state.history.activate(state.get());
  renderGenericSheet(state.get());state.syncHistoryBaseline();sheetSearch?.refresh();
  updateAppState({currentSystem:systemSummary(pkg.system)});
}

async function refreshEditorDrafts() {
  const host=$('editor-drafts');
  try {
    const {listDrafts,decodeDraft,deleteDraft}=await import('./editor/draft-repository.js');
    host.replaceChildren(element('h2','','Rascunhos JSON locais'));host.classList.add('editor-drafts');
    for(const entry of listDrafts()){
      const card=element('article');card.append(element('p','',entry.error || `${entry.draft.lastValid?.package.system.name || entry.draft.source?.name || 'Rascunho'} · revisão ${entry.draft.revision}`));
      if(entry.draft)card.append(actionButton('Recuperar rascunho','button button--ghost',()=>runAction(()=>openJsonEditor({draft:entry.draft,draftRaw:entry.raw}))));
      card.append(actionButton('Baixar original','button button--ghost',()=>storage.downloadText(entry.raw,'rascunho-original.json')),
        actionButton('Excluir rascunho','button button--danger',()=>runAction(async()=>{if(await confirmDialog('Excluir somente este rascunho local? A biblioteca permanece separada.',{title:'Excluir rascunho',confirmLabel:'Excluir rascunho'})){await deleteDraft(entry.key,entry.raw);await refreshEditorDrafts();}})));
      host.append(card);
    }
    if(!host.querySelector('article'))host.append(element('p','','Nenhum rascunho salvo. Rascunhos não fazem parte de Exportar tudo.'));
  }catch(error){host.textContent=`Rascunhos indisponíveis: ${error.message}. Nenhum original foi sobrescrito.`;}
}

async function init() {
  try { await recoverTransactions(); } catch { /* adapter mantém bloqueio e journal para recuperação */ }
  const session = storage.loadAppSession();
  if (session.activeTab) setAppState('ui.activeTab', session.activeTab);
  if (['legacy', 'engine', 'compare'].includes(session.dndPresentation)) {
    setAppState('ui.dndPresentation', session.dndPresentation);
  }
  initTheme();
  initAppearanceControls();
  initCalculationSettings();
  initArtworkControls();
  initShell();
  initShellActions();
  characterHistoryControls = initCharacterHistoryControls({
    isAvailable: () => Boolean(activeCharacterId && getAppState().currentCharacter && getAppState().currentView === 'sheet'),
    validate: character => assertValid(character, value => validateCharacterForPackage(value, activePackage), 'personagem'),
  });
  initBackupControls({
    beforeRestore:()=>flushCharacterSave(),
    getCurrentCharacter: () => activeCharacterId ? state.get() : null,
    onRestored: async () => {
      state.clearHistory();
      clearTimeout(saveTimeout); saveTimeout = null; unsavedCharacter = false;
      const previousId = activeCharacterId;
      activeCharacterId = null;
      refreshLibraries();
      initTheme();
      applyArtworkPreferences();
      applyCalculationPreferences();
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
    layout: printLayout(activePackage, activeLayout), system: activePackage.system, character: state.get(),
  } : null);
  sheetSearch = initSheetSearch({
    getIndex: () => activeCharacterId && activePackage ? layoutSearchIndex(activePackage,
      activePackage.system.id === DND_SYSTEM_ID && getAppState().ui.dndPresentation === 'legacy' ? activePackage.layouts[0] : activeLayout, state.get()) : [],
    onShortcut: () => {if(getAppState().currentView==='editor')return false;setAppState('currentView', 'sheet');},
    onNavigate: async (entry) => {
      if (!activeCharacterId || !getAppState().currentCharacter) return;
      if (entry.layoutId !== activeLayout.id) await selectSheetLayout(entry.layoutId, { preservePresentation: true });
      if (activePackage.system.id === DND_SYSTEM_ID && entry.layoutId !== activePackage.layouts[0].id && getAppState().ui.dndPresentation === 'legacy') setAppState('ui.dndPresentation', 'engine');
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
  appInitialized=true;
  renderShell(getAppState());
  persistAppState(getAppState());
  initPwa({ beforeReload: async () => {await flushCharacterSave({ force: true });await flushLibraryWrites();} });
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
    button.addEventListener('click', () => runAction(async()=>{await flushCharacterSave();setAppState('ui.dndPresentation', button.dataset.dndPresentation);}));
  });
}

function initShell() {
  $('btn-create-package').addEventListener('click',()=>runAction(()=>openJsonEditor()));
  $('btn-open-editor-file').addEventListener('click',()=>$('input-editor-file').click());
  $('input-editor-file').addEventListener('change',()=>runAction(async()=>{
    const [file]=$('input-editor-file').files;$('input-editor-file').value='';if(!file)return;
    if(file.size>20*1024**2)throw new Error('Arquivo excede 20 MiB.');
    const text=await file.text();let value;try{value=JSON.parse(text);}catch{}
    if(value?.kind==='rpg-editor-draft'){
      const {decodeDraft}=await import('./editor/draft-repository.js'),draft=decodeDraft(text);
      draft.draftId=crypto.randomUUID();await openJsonEditor({draft,draftRaw:null});
    }else {if(file.size>4*1024**2)throw new Error('Pacote excede 4 MiB.');await openJsonEditor({text,source:{kind:'file',name:file.name,base:null}});}
  }));
  $('sheet-layout-select').addEventListener('change', event => runAction(()=>selectSheetLayout(event.target.value)));
  document.querySelectorAll('[data-app-view-target]').forEach((button) => {
    button.addEventListener('click', () => {if(getAppState().currentView==='editor'){runAction(()=>jsonEditor.exit(button.dataset.appViewTarget));return;}setAppState('currentView', button.dataset.appViewTarget);});
  });

  subscribeAppState((appState) => {
    renderShell(appState);
    if (appPersistenceEnabled) persistAppState(appState);
  });
  renderShell(getAppState());
}

function renderShell(appState) {
  document.querySelectorAll('[data-app-view-target]').forEach(button=>{button.disabled=!appInitialized;});
  $('secondary-actions').hidden=appState.currentView==='editor';
  $('btn-more').hidden=appState.currentView==='editor';
  if(appState.currentView==='systems')refreshEditorDrafts();
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
  $('sheet-heading').dataset.variant = activeLayout?.variant || '';
  $('sheet-layout-controls').hidden = !appState.currentCharacter;
  $('sheet-history-controls').hidden = !appState.currentCharacter;
  characterHistoryControls?.refresh();
  $('sheet-layout-select').disabled = !appState.currentCharacter;
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
  preserveMountData=false;
  activePackage = pkg;
  activeLayout = preferredLayout(pkg);
  setSystem(pkg.system);
  setLayout(activeLayout);
  renderLayoutControls();
}

function renderLayoutControls() {
  const select = $('sheet-layout-select');
  select.replaceChildren(...activePackage.layouts.map(layout => {
    const option = element('option', '', layoutName(layout));
    option.value = layout.id;
    return option;
  }));
  select.value = activeLayout.id;
  select.title = `Layout da ficha: ${layoutName(activeLayout)}`;
  select.style.setProperty('--layout-select-width', `${Math.min(32, Math.max(18, ...activePackage.layouts.map(layout => layoutName(layout).length + 5)))}ch`);
  $('view-sheet').dataset.sheetMode = activeLayout.mode || 'sheet';
}

async function selectSheetLayout(id, { preservePresentation = false } = {}) {
  const next = activePackage?.layouts.find(layout => layout.id === id);
  if (!next) return;
  await flushCharacterSave();
  await rememberLayout(activePackage.system.id, next.id);
  genericSheetController?.destroy();
  genericSheetController = null;
  activeLayout = next;
  setLayout(next);
  renderLayoutControls();
  if (!preservePresentation && activePackage.system.id === DND_SYSTEM_ID && getAppState().ui.dndPresentation === 'legacy') setAppState('ui.dndPresentation', 'engine');
  if (!genericSheetController && (activePackage.system.id !== DND_SYSTEM_ID || getAppState().ui.dndPresentation !== 'legacy')) renderGenericSheet(state.get());
  renderShell(getAppState());
  state.syncHistoryBaseline();
  sheetSearch?.refresh();
}

async function openCharacter(id, { view = 'sheet' } = {}) {
  await flushCharacterSave();
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
  activeCharacterRaw=characters.rawCharacter(character.meta.id);
  suppressCharacterEffects = true;
  state.load(character);
  suppressCharacterEffects = false;

  updateAppState({
    currentSystem: systemSummary(pkg.system),
    currentCharacter: characterSummary(character),
    currentView: view,
  });
  mountActiveSheet(character);
  state.syncHistoryBaseline();
  refreshLibraries();
}

async function openSystem(systemId) {
  const existing = characters.listCharacters().find((character) => character.system === systemId);
  if (existing) await openCharacter(existing.id);
  else await createAndOpenCharacter(systemId);
}

async function createAndOpenCharacter(systemId, { notifyUser = true } = {}) {
  await flushCharacterSave();
  const pkg = await activateSystem(systemId);
  const character = await characters.createCharacter(pkg.system);
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
  $('sheet-layout-hint').textContent = isDnd && presentation === 'legacy'
    ? 'Escolher um layout abre a ficha modular.' : activeLayout.mode === 'table'
      ? 'Recursos e ações para a sessão. Outros campos continuam na busca e no layout completo.'
      : 'Todos os campos desta apresentação.';
  const compare = isDnd && presentation === 'compare';
  $('dnd-presentation-controls').hidden = !isDnd;
  $('legacy-dnd-sheet').hidden = !isDnd || presentation === 'engine';
  $('generic-sheet-host').hidden = isDnd && presentation === 'legacy';
  $('dice-tray').hidden = activePackage.system.diceTray === false;
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
    genericSheetController = renderSheet(host, activeLayout, character, {
      materializeDefaults:!preserveMountData,
      validateCharacter:value=>assertValid(value,entry=>validateCharacterForPackage(entry,activePackage),'personagem'),
      showHeader: false,
      system: activePackage.system,
      upgradeCharacter: async current => {
        if (current.schemaVersion !== 1 || current !== state.get()) throw new Error('Personagem mudou; abra a ficha novamente.');
        await flushCharacterSave();
        const upgraded = { ...structuredClone(current), schemaVersion: 2, activeEffects: [] };
        assertValid(upgraded, value => validateCharacterForPackage(value,activePackage),'personagem');
        const stored = await characters.saveCharacter(upgraded,{copies:[migrationCopyChange(`effects:${current.meta.id}`,current)],expectedPackage:activePackage,expectedRaw:()=>activeCharacterRaw});
        activeCharacterRaw=JSON.stringify(stored);
        Object.assign(current,stored);
        state.clearHistory(); state.history.activate(current);
      },
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
  if (state.replayingHistory) {
    const host = $('generic-sheet-host');
    const restoreFocus = captureFocus(host);
    const openEntries = [...host.querySelectorAll('details[data-entry-id][open]')].map(entry => ({
      id: entry.dataset.entryId, component: entry.closest('[data-search-key]')?.dataset.searchKey,
    }));
    if (activePackage?.system.id === DND_SYSTEM_ID) ui.renderAll(character);
    if (genericSheetController) {
      genericSheetController.destroy(); genericSheetController = null;
      renderGenericSheet(character);
      for (const entry of host.querySelectorAll('details[data-entry-id]')) {
        if (openEntries.some(open => open.id === entry.dataset.entryId && open.component === entry.closest('[data-search-key]')?.dataset.searchKey)) entry.open = true;
      }
      restoreFocus();
    }
  } else if (activePackage?.system.id === DND_SYSTEM_ID) {
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
  } else if(preserveMountData && !engineChangeInProgress && genericSheetController){
    genericSheetController.destroy();genericSheetController=null;renderGenericSheet(character);
  }
  scheduleCharacterSave(character);
  sheetSearch?.refresh();
  updateAppState({ currentCharacter: characterSummary(character) });
}

function scheduleCharacterSave(character) {
  unsavedCharacter=true;
  $('save-indicator').textContent = 'Salvando...';
  clearTimeout(saveTimeout);
  const snapshot = structuredClone(character);
  const revision=++characterSaveRevision,expectedPackage=structuredClone(activePackage);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    characterSavePromise=(async()=>{try {
      assertValid(snapshot,value=>validateCharacterForPackage(value,expectedPackage),'personagem');
      const saved = await characters.saveCharacter(snapshot,{expectedPackage,expectedRaw:()=>activeCharacterRaw});
      activeCharacterRaw=JSON.stringify(saved);
      if(revision!==characterSaveRevision)return;
      unsavedCharacter = false;
      refreshLibraries();
      updateAppState({ currentCharacter: characterSummary(saved) });
      $('save-indicator').textContent = 'Salvo';
    } catch (error) { unsavedCharacter = true; $('save-indicator').textContent = 'Não salvo — exporte seus dados'; reportStorageError(error); }})();
  }, 300);
}

async function flushCharacterSave({ force = false } = {}) {
  await characterSavePromise;
  if ((!saveTimeout && !force && !unsavedCharacter) || !activeCharacterId) return;
  clearTimeout(saveTimeout);
  saveTimeout = null;
  const current = state.get();
  try {
    if (current.meta?.id === activeCharacterId) {
      assertValid(current,value=>validateCharacterForPackage(value,activePackage),'personagem');
      const saved=await characters.saveCharacter(current,{expectedPackage:activePackage,expectedRaw:()=>activeCharacterRaw});
      activeCharacterRaw=JSON.stringify(saved);
    }
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
      actionButton(system.source==='builtin'?'Editar cópia':'Editar pacote','button button--ghost',()=>runAction(async()=>{
        const original=await exportSystemPackage(system.id);
        const pkg=system.source==='builtin'?(await import('./editor/package-commands.js')).copyPackage(original):original;
        await openJsonEditor({text:JSON.stringify(pkg,null,2),source:{kind:system.source==='builtin'?'copy':'imported',systemId:pkg.system.id,base:system.source==='builtin'?null:original}});
      })),
    );
    if(system.unavailable) { actions.querySelector('button').disabled=true; card.appendChild(element('p','library-card__warning','Pacote indisponível. Exporte o original ou a recuperação para corrigir.')); }
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
    openButton.disabled = !system || system.unavailable || character.unavailable;
    if(character.unavailable) card.appendChild(element('p','library-card__warning','Documento indisponível nesta versão. O original pode ser exportado.'));
    actions.append(
      openButton,
      actionButton('Duplicar', 'button button--ghost', () => runAction(async () => {
        const copy = await characters.duplicateCharacter(character.id);
        refreshLibraries();
        await openCharacter(copy.meta.id);
      })),
      actionButton('Exportar', 'button button--ghost', () => {
        if(character.unavailable) {
          const blob=new Blob([characters.rawCharacter(character.id)],{type:'application/json'});
          const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download=`${character.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
        }
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
    await flushCharacterSave();
    activeCharacterId = null;
    updateAppState({ currentCharacter: null, currentView: 'characters' });
  }
  await characters.removeCharacter(id);
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
    state.load(reset, { record: true, label: 'Limpar ficha' });
    mountActiveSheet(reset);
    state.syncHistoryBaseline();
    notify('Ficha restaurada.');
  }));

  $('btn-save-character').addEventListener('click', () => runAction(async () => {
    await flushCharacterSave({ force: true });
    refreshLibraries();
    notify('Personagem salvo.');
  }));

  $('btn-export').addEventListener('click', async () => {
    if (!activeCharacterId) return;
    try { await flushCharacterSave(); } catch (error) { reportStorageError(error); }
    const exported = characters.exportCharacter(state.get());
    storage.downloadJson(exported.data, exported.filename);
    notify('Personagem exportado.');
  });

  $('btn-import').addEventListener('click', () => $('input-import-file').click());
  $('input-import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    await runAction(async () => {
      const character = await characters.importCharacter(file, { confirmMigration, validate: async value => {
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
      await flushCharacterSave();
      try { pkg = await importSystemPackage(file,{currentCharacter:state.get(),confirmMigration}); }
      catch (error) {
        if (error.code !== 'system-conflict') throw error;
        if (!await confirmDialog('Substituir este sistema? Personagens existentes serão preservados, mas o novo layout pode ser incompatível.', {title: 'Sistema já existente', confirmLabel: 'Substituir sistema'})) return;
        await flushCharacterSave();
        pkg = await importSystemPackage(file, {replace: true,currentCharacter:state.get(),confirmMigration,expectedBase:error.base});
        state.clearHistory();
        refreshInstalledPackage(pkg);
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
  $('dice-expression-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = rollExpression($('dice-expression').value, 'Rolagem personalizada');
      $('dice-expression-error').textContent = '';
      document.dispatchEvent(new CustomEvent('sheet:rolled', { detail: result }));
    } catch (error) { $('dice-expression-error').textContent = error.message; }
  });
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
  const displayRoll = (event) => {
    const result = event.detail;
    $('dice-result').textContent = `${result.formula} = ${result.total}`;
    renderDiceHistory();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };
  document.addEventListener('dnd:rolled', displayRoll);
  document.addEventListener('sheet:rolled', displayRoll);
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
    list.appendChild(element('li', 'dice-history__entry', `${entry.label ? `${entry.label}: ` : ''}${entry.formula} → ${entry.rolls.join(', ')} = ${entry.total}`));
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
    currentView: appState.currentView==='editor'?'systems':appState.currentView,
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
  if(saveTimeout || unsavedCharacter || hasPendingLibraryWrites() || jsonEditor && !jsonEditor.disposed && jsonEditor.session.lastSavedRevision!==jsonEditor.session.revision){event.preventDefault();event.returnValue='';}
  flushCharacterSave().catch(reportStorageError);
});
window.addEventListener('character:saved',event=>{if(event.detail.id===activeCharacterId)activeCharacterRaw=event.detail.raw;});
window.addEventListener('storage',event=>{
  if(event.key==='ficha-rpg:v2:systems'){
    reloadImportedSystems();refreshLibraries();
    if(activePackage && listSystems().some(system=>system.id===activePackage.system.id && system.source==='imported'))notify('A biblioteca de sistemas mudou em outra aba. Suas edições continuam em memória; reabra a ficha antes de salvar com as novas regras.',{type:'error'});
  }
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

function confirmMigration(plan) {
  return confirmDialog(`Atualizar os nomes antigos na cópia importada? ${plan.changes.length} alteração(ões). ${plan.changes.slice(0,8).join('; ')}. O original ficará na recuperação.`,{title:'Revisar migração',confirmLabel:'Migrar e importar'});
}
