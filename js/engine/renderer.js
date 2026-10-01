// Renderizador declarativo: Layout → Tabs → Sections → Containers → Components.
// A estrutura, o conteúdo e as regras vêm dos JSONs; este módulo cuida somente
// da composição acessível e do vínculo entre componentes e personagem.
import { getFieldType } from './fields.js';
import './advanced-fields.js';

export function renderSheet(host, layout, character, options = {}) {
  host.innerHTML = '';
  if (!layout) return { activate: () => {}, destroy: () => {} };

  const sheetVariant = safeToken(layout.variant);
  const sheet = element('div', `engine-sheet${sheetVariant ? ` engine-sheet--${sheetVariant}` : ''}`);
  const header = element('header', 'engine-sheet__header');
  const title = element('h1', 'engine-sheet__title', characterName(character));
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

    const panel = renderTab(tab, character, componentOptions);
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

  if (layout.showHeader !== false) sheet.appendChild(header);
  sheet.append(navigation, panels);
  host.appendChild(sheet);
  const requestedIndex = tabs.findIndex(({ id }) => id === options.initialTabId);
  activate(requestedIndex >= 0 ? requestedIndex : 0, { focus: false });

  return {
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
  (tab.sections || []).forEach((section) => {
    panel.appendChild(renderSection(section, character, options));
  });
  return panel;
}

function renderSection(section, character, options) {
  const variant = safeToken(section.variant);
  const sectionEl = element('article', `engine-section${variant ? ` engine-section--${variant}` : ''}`);
  if (section.title) {
    const header = element('header', 'engine-section__header');
    header.appendChild(element('h2', 'engine-section__title', section.title));
    if (section.note || section.notes) {
      header.appendChild(element('p', 'engine-section__note', section.note || section.notes));
    }
    sectionEl.appendChild(header);
  }

  const body = element('div', 'engine-section__body');
  (section.containers || []).forEach((definition) => {
    body.appendChild(renderContainer(definition, character, options));
  });
  sectionEl.appendChild(body);
  return sectionEl;
}

function renderContainer(container, character, options) {
  const layout = container.layout || { type: 'stack' };
  const variant = safeToken(container.variant);
  const content = element('div', `engine-container engine-container--${layout.type || 'stack'}${variant ? ` engine-container--${variant}` : ''}`);
  addLayoutHintClass(content, 'min', layout.min);
  addLayoutHintClass(content, 'gap', layout.gap);

  const repeatItems = container.repeat
    ? resolveSource(options.system, container.repeat.source.replace(/^system\./, ''))
    : [null];

  repeatItems.forEach((item, index) => {
    (container.components || []).forEach((definition) => {
      const component = interpolate(definition, repeatContext(item, index));
      if (component.optionsFrom && !component.options) {
        component.options = normalizeOptions(resolveSource(options.system, component.optionsFrom.replace(/^system\./, '')));
      }
      content.appendChild(renderComponent(component, character, options));
    });
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
    dieScale: options.system?.dieScale || options.system?.diceSet,
    onChange: () => options.onChange?.(character, component),
  });
  return wrapper;
}

function resolveSource(root, path) {
  if (!root || !path) return [];
  let values = [root];
  path.split('.').forEach((segment) => {
    const flatten = segment.endsWith('[]');
    const key = flatten ? segment.slice(0, -2) : segment;
    values = values.flatMap((value) => {
      const next = value?.[key];
      if (next == null) return [];
      return flatten && Array.isArray(next) ? next : [next];
    });
  });
  return values.flatMap((value) => Array.isArray(value) ? value : [value]);
}

function repeatContext(item, index) {
  if (item && typeof item === 'object') return { index, ...item };
  return { index, key: item, name: item, label: item, value: item };
}

function interpolate(value, context) {
  if (typeof value === 'string') {
    return value.replace(/\{([^}]+)\}/g, (_, key) => context[key] ?? `{${key}}`);
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, context)]));
  }
  return value;
}

function normalizeOptions(items) {
  return items.map((item, index) => {
    if (item == null || typeof item !== 'object') return { value: item, label: String(item ?? '') };
    return {
      value: item.value ?? item.id ?? item.key ?? index,
      label: item.label ?? item.name ?? (item.points != null ? `${item.points} pontos` : String(item.id ?? index + 1)),
    };
  });
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
