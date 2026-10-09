// Renderizador declarativo: Layout → Tabs → Sections → Containers → Components.
// A estrutura, o conteúdo e as regras vêm dos JSONs; este módulo cuida somente
// da composição acessível e do vínculo entre componentes e personagem.
import { getFieldType } from './fields.js';
import './advanced-fields.js';
import './point-fields.js';
import './assisted-fields.js';
import './recovery-fields.js';
import './check-fields.js';
import {createCheckButton} from './check-fields.js';
import './effect-fields.js';
import './technique-fields.js';
import { getByPath, setByPath } from './paths.js';
import { appendFieldHelp } from './help.js';
import { expandComponents, componentSearchKey } from './layout-components.js';
import { highlightSearchTarget } from './search.js';
import {commitRenderedChanges} from './render-projection.js';

export function renderSheet(host, layout, character, options = {}) {
  if(options.materializeDefaults===false && !options.projected){
    const model=structuredClone(character);let original=structuredClone(character),baseline;
    const controller=renderSheet(host,layout,model,{...options,projected:true,
      upgradeCharacter:options.upgradeCharacter?async()=>{await options.upgradeCharacter(character);model.schemaVersion=character.schemaVersion;model.activeEffects=structuredClone(character.activeEffects);original=structuredClone(character);}:undefined,
      onChange:()=>{commitRenderedChanges(character,original,baseline,model,options.validateCharacter);original=structuredClone(character);baseline=structuredClone(model);options.onChange?.(character);},
    });
    baseline=structuredClone(model);return controller;
  }
  host.innerHTML = '';
  if (!layout) return { activate: () => {}, destroy: () => {} };
  // Defaults antes das fórmulas: a ordem visual não pode alterar os cálculos.
  (layout.tabs || []).forEach((tab) => (tab.sections || []).forEach((section) => (section.containers || []).forEach((container) => (container.components || []).forEach((component) => {
    if (options.materializeDefaults!==false && component.default !== undefined && component.field && !component.field.includes('{') && getByPath(character, component.field) == null) {
      setByPath(character, component.field, structuredClone(component.default));
    }
  }))));

  const sheetVariant = safeToken(layout.variant);
  const sheet = element('div', `engine-sheet${sheetVariant ? ` engine-sheet--${sheetVariant}` : ''}`);
  const header = element('header', 'engine-sheet__header');
  const title = element('h1', 'engine-sheet__title', characterName(character));
  options.onRenderSource?.(sheet, []);
  header.append(
    element('p', 'engine-sheet__eyebrow', options.system?.name || layout.system),
    title,
  );

  const navigation = element('div', 'engine-tabs');
  navigation.setAttribute('role', 'tablist');
  navigation.setAttribute('aria-label', 'Seções da ficha');
  const panels = element('div', 'engine-panels');
  const tabs = [];
  const cleanups = [];
  const refreshers = new Set();
  const componentOptions = {
    ...options,
    registerRefresh(refresh) {
      refreshers.add(refresh);
      return () => refreshers.delete(refresh);
    },
    onChange(updatedCharacter, component) {
      title.textContent = characterName(updatedCharacter);
      refreshers.forEach((refresh) => refresh());
      options.onChange?.(updatedCharacter, component);
    },
  };

  (layout.tabs || []).forEach((tab, index) => {
    const tabId = `engine-tab-${layout.id}-${tab.id}`;
    const panelId = `engine-panel-${layout.id}-${tab.id}`;
    const button = element('button', 'engine-tab', tab.label);
    button.type = 'button';
    button.id = tabId;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
    options.onRenderSource?.(button, ['tabs',index]);

    const panel = renderTab(tab, character, {...componentOptions, sourcePath:['tabs',index]});
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    navigation.appendChild(button);
    panels.appendChild(panel);
    tabs.push({ id: tab.id, button, panel });

    const onClick = () => activate(index, { focus: false });
    const onKeydown = (event) => {
      const target = keyboardTarget(event, index, tabs.length);
      if (target === null) return;
      event.preventDefault();
      activate(target);
    };
    button.addEventListener('click', onClick);
    button.addEventListener('keydown', onKeydown);
    cleanups.push(() => {
      button.removeEventListener('click', onClick);
      button.removeEventListener('keydown', onKeydown);
    });
  });

  function activate(index, { focus = true } = {}) {
    if (!tabs.length) return;
    const safeIndex = Math.max(0, Math.min(index, tabs.length - 1));
    tabs.forEach(({ button, panel }, itemIndex) => {
      const selected = itemIndex === safeIndex;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      panel.toggleAttribute('hidden', !selected);
    });
    if (focus) tabs[safeIndex].button.focus();
    options.onTabChange?.(tabs[safeIndex].id);
  }

  if (layout.showHeader !== false && options.showHeader !== false) sheet.appendChild(header);
  sheet.append(navigation, panels);
  host.appendChild(sheet);
  const requestedIndex = tabs.findIndex(({ id }) => id === options.initialTabId);
  activate(requestedIndex >= 0 ? requestedIndex : 0, { focus: false });

  return {
    revealSearchResult(entry) {
      const index = tabs.findIndex(({ id }) => id === entry.tabId);
      if (index < 0) return;
      activate(index, { focus: false });
      const wrapper = [...tabs[index].panel.querySelectorAll('[data-search-key]')].find((node) => node.dataset.searchKey === entry.componentKey);
      if (!wrapper) return;
      const customTarget = getFieldType(entry.component.type)?.revealSearchResult?.(wrapper, entry);
      let target = customTarget || wrapper;
      if (!customTarget && entry.itemIndex != null) {
        // Uma pesquisa local na tabela não pode esconder o resultado global.
        const filter = wrapper.querySelector('input[type="search"]');
        if (filter?.value) { filter.value = ''; filter.dispatchEvent(new Event('input', { bubbles: true })); }
        target = wrapper.querySelectorAll('.engine-entry, tbody > tr:not(.engine-table__details-row), .engine-slot')[entry.itemIndex] || wrapper;
        if (target.matches('details')) target.open = true;
        if (entry.component.itemDetails && target.matches('tr')) {
          const secondary = target.nextElementSibling;
          if (secondary?.classList.contains('engine-table__details-row') && entry.component.itemDetails.fields.includes(entry.itemField)) target = secondary;
        }
        if (entry.itemField) target = [...target.querySelectorAll('[data-item-field]')].find((node) => node.dataset.itemField === entry.itemField) || target;
      }
      for (let ancestor = target.parentElement; ancestor && ancestor !== wrapper; ancestor = ancestor.parentElement) {
        if (ancestor.matches('details')) ancestor.open = true;
      }
      highlightSearchTarget(target);
    },
    activate(tabId, activateOptions) {
      const index = tabs.findIndex(({ id }) => id === tabId);
      if (index >= 0) activate(index, activateOptions);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      refreshers.clear();
      host.innerHTML = '';
    },
  };
}

export function renderTab(tab, character, options = {}) {
  const variant = safeToken(tab.variant);
  const panel = element('section', `engine-panel${variant ? ` engine-panel--${variant}` : ''}`);
  options.onRenderSource?.(panel, options.sourcePath || []);
  (tab.sections || []).forEach((section,index) => {
    panel.appendChild(renderSection(section, character, {...options,sourcePath:[...(options.sourcePath || []),'sections',index]}));
  });
  return panel;
}

function renderSection(section, character, options) {
  const variant = safeToken(section.variant);
  const sectionEl = element('article', `engine-section${variant ? ` engine-section--${variant}` : ''}`);
  options.onRenderSource?.(sectionEl, options.sourcePath);
  if (section.title) {
    const header = element('header', 'engine-section__header');
    header.appendChild(element('h2', 'engine-section__title', section.title));
    if (section.note || section.notes) {
      header.appendChild(element('p', 'engine-section__note', section.note || section.notes));
    }
    sectionEl.appendChild(header);
  }

  const body = element('div', 'engine-section__body');
  (section.containers || []).forEach((definition,index) => {
    body.appendChild(renderContainer(definition, character, { ...options, searchSection: section,sourcePath:[...options.sourcePath,'containers',index] }));
  });
  sectionEl.appendChild(body);
  return sectionEl;
}

function renderContainer(container, character, options) {
  const layout = container.layout || { type: 'stack' };
  const variant = safeToken(container.variant);
  const content = element('div', `engine-container engine-container--${layout.type || 'stack'}${variant ? ` engine-container--${variant}` : ''}`);
  options.onRenderSource?.(content, options.sourcePath);
  addLayoutHintClass(content, 'min', layout.min);
  addLayoutHintClass(content, 'gap', layout.gap);

  expandComponents(container, options.system).forEach((component, index) => {
    const wrapper = renderComponent(component, character, options);
    // Repeat expands values, but each instance still comes from the original
    // component definition. Labels and field values are not source identities.
    options.onRenderSource?.(wrapper, [...options.sourcePath,'components',index % container.components.length]);
    wrapper.dataset.searchKey = componentSearchKey(options.searchSection, container, index);
    content.appendChild(wrapper);
  });

  if (!content.children.length) {
    content.appendChild(element('p', 'engine-empty', 'Esta seção ainda não possui campos.'));
  }
  return content;
}

function renderComponent(component, character, options) {
  const variant = safeToken(component.variant);
  const wrapper = element('div', `engine-component${variant ? ` engine-component--${variant}` : ''}`);
  if (component.field) wrapper.dataset.field = component.field;
  const fieldType = getFieldType(component.type);
  if (!fieldType) {
    wrapper.classList.add('engine-component--pending');
    wrapper.append(
      element('span', 'engine-component__pending-label', component.label || component.type),
      element('span', 'engine-component__pending-type', `Componente ${component.type}`),
    );
    return wrapper;
  }

  fieldType.render(wrapper, {
    ...component,
    character,
    system: options.system,
    registerRefresh: options.registerRefresh,
    upgradeCharacter: options.upgradeCharacter,
    preview: options.preview,
    materializeDefaults: options.materializeDefaults,
    dieScale: options.system?.dieScale || options.system?.diceSet,
    onChange: () => options.onChange?.(character, component),
  });
  if (component.help) appendFieldHelp(wrapper.querySelector('.field') || wrapper, component.help, component.label || component.type);
  if (component.roll && component.type !== 'list') wrapper.append(createCheckButton({...component,character,system:options.system}));
  if (component.disabledWhen) {
    const refresh = () => {
      const disabled = getByPath(character, component.disabledWhen.field) === component.disabledWhen.equals;
      wrapper.querySelectorAll('input, select, textarea, button').forEach((control) => { if (!control.matches('.engine-help__trigger')) control.disabled = disabled || control.dataset.intrinsicDisabled === 'true'; });
    };
    refresh();
    options.registerRefresh?.(refresh);
  }
  return wrapper;
}

function addLayoutHintClass(elementNode, hint, value) {
  const numeric = Number.parseInt(value, 10);
  const supported = hint === 'min' ? [120, 140, 160, 180, 220, 260, 300] : [4, 8, 12, 16, 24, 32];
  if (supported.includes(numeric)) elementNode.classList.add(`engine-container--${hint}-${numeric}`);
}

function keyboardTarget(event, index, length) {
  if (event.key === 'ArrowRight') return (index + 1) % length;
  if (event.key === 'ArrowLeft') return (index - 1 + length) % length;
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return length - 1;
  return null;
}

function characterName(character) {
  return character.identity?.name?.trim() || character.name?.trim() || 'Personagem sem nome';
}

function safeToken(value) {
  return typeof value === 'string' && /^[a-z0-9-]+$/i.test(value) ? value : '';
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}
