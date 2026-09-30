// engine/renderer.js
// Renderizador genérico de layout: transforma tab/section/container/component
// em DOM, delegando cada campo ao seu tipo registrado em fields.js. Não sabe nada
// sobre D&D nem sobre nenhum sistema específico — apenas segue a descrição recebida.
import { getFieldType } from './fields.js';

export function renderTab(container, tab, character, { onChange } = {}) {
  container.innerHTML = '';
  if (!tab) return;

  const tabEl = document.createElement('section');
  tabEl.className = 'engine-tab';

  if (tab.label) {
    const heading = document.createElement('h2');
    heading.textContent = tab.label;
    tabEl.appendChild(heading);
  }

  (tab.sections || []).forEach((section) => {
    tabEl.appendChild(renderSection(section, character, onChange));
  });

  container.appendChild(tabEl);
}

function renderSection(section, character, onChange) {
  const sectionEl = document.createElement('div');
  sectionEl.className = 'engine-section';

  if (section.title) {
    const heading = document.createElement('h3');
    heading.textContent = section.title;
    sectionEl.appendChild(heading);
  }

  (section.containers || []).forEach((definition) => {
    sectionEl.appendChild(renderContainer(definition, character, onChange));
  });

  return sectionEl;
}

function renderContainer(container, character, onChange) {
  const layout = container.layout || { type: 'stack' };
  const content = document.createElement('div');
  content.className = `engine-container engine-container--${layout.type}`;

  if (layout.type === 'grid') {
    content.style.display = 'grid';
    content.style.gridTemplateColumns = `repeat(auto-fit, minmax(${layout.min || 'min(100%, 220px)'}, 1fr))`;
  } else if (layout.type === 'flex') {
    content.style.display = 'flex';
    content.style.flexWrap = 'wrap';
  }
  content.style.gap = `${layout.gap ?? 8}px`;

  (container.components || []).forEach((component) => {
    content.appendChild(renderComponent(component, character, onChange));
  });

  return content;
}

function renderComponent(component, character, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'engine-component';

  const fieldType = getFieldType(component.type);
  if (!fieldType) {
    wrapper.textContent = `[tipo de campo não registrado: "${component.type}"]`;
    return wrapper;
  }

  fieldType.render(wrapper, {
    character,
    field: component.field,
    label: component.label,
    options: component.options,
    onChange: () => onChange?.(character),
  });

  return wrapper;
}
