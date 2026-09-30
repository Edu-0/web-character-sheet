// engine/renderer.js
// Renderizador genérico de layout: transforma page/section/component (do layout.json)
// em DOM, delegando cada campo ao seu tipo registrado em fields.js. Não sabe nada
// sobre D&D nem sobre nenhum sistema específico — apenas segue a descrição recebida.
import { getFieldType } from './fields.js';

export function renderPage(container, page, character, { onChange } = {}) {
  container.innerHTML = '';
  if (!page) return;

  const pageEl = document.createElement('section');
  pageEl.className = 'engine-page';

  if (page.title) {
    const heading = document.createElement('h2');
    heading.textContent = page.title;
    pageEl.appendChild(heading);
  }

  (page.sections || []).forEach((section) => {
    pageEl.appendChild(renderSection(section, page, character, onChange));
  });

  container.appendChild(pageEl);
}

function renderSection(section, page, character, onChange) {
  const sectionEl = document.createElement('div');
  sectionEl.className = 'engine-section';

  if (section.title) {
    const heading = document.createElement('h3');
    heading.textContent = section.title;
    sectionEl.appendChild(heading);
  }

  const columns = section.layout?.columns ?? page.layout?.columns ?? 12;
  const gap = section.layout?.gap ?? page.layout?.gap ?? 8;

  const grid = document.createElement('div');
  grid.className = 'engine-grid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  grid.style.gap = `${gap}px`;

  (section.components || []).forEach((component) => {
    grid.appendChild(renderComponent(component, columns, character, onChange));
  });

  sectionEl.appendChild(grid);
  return sectionEl;
}

function renderComponent(component, columns, character, onChange) {
  const wrapper = document.createElement('div');
  wrapper.style.gridColumn = `span ${component.span || columns}`;

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
