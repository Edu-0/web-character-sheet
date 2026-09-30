// engine/fields.js
// Registro de tipos de campo ("component registry"). Cada tipo sabe ler/escrever
// seu valor no character (via caminho pontilhado) e como se desenhar. Novos tipos
// podem ser adicionados chamando registerFieldType — o núcleo da engine nunca
// precisa de um if/else por tipo.
import { getByPath, setByPath } from './paths.js';

const registry = new Map();

export function registerFieldType(type, definition) {
  registry.set(type, definition);
}

export function getFieldType(type) {
  return registry.get(type);
}

export function hasFieldType(type) {
  return registry.has(type);
}

function fieldWrapper(label, className = 'field') {
  const wrap = document.createElement('label');
  wrap.className = className;
  const span = document.createElement('span');
  span.textContent = label;
  wrap.appendChild(span);
  return wrap;
}

registerFieldType('number', {
  render(container, { character, field, label, onChange }) {
    const wrap = fieldWrapper(label);
    const input = document.createElement('input');
    input.type = 'number';
    input.value = getByPath(character, field) ?? 0;
    input.addEventListener('input', () => {
      setByPath(character, field, input.value === '' ? 0 : Number(input.value));
      onChange?.();
    });
    wrap.appendChild(input);
    container.appendChild(wrap);
  },
});

registerFieldType('text', {
  render(container, { character, field, label, onChange }) {
    const wrap = fieldWrapper(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getByPath(character, field) ?? '';
    input.addEventListener('input', () => {
      setByPath(character, field, input.value);
      onChange?.();
    });
    wrap.appendChild(input);
    container.appendChild(wrap);
  },
});

registerFieldType('textarea', {
  render(container, { character, field, label, onChange }) {
    const wrap = fieldWrapper(label);
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.value = getByPath(character, field) ?? '';
    textarea.addEventListener('input', () => {
      setByPath(character, field, textarea.value);
      onChange?.();
    });
    wrap.appendChild(textarea);
    container.appendChild(wrap);
  },
});

registerFieldType('boolean', {
  render(container, { character, field, label, onChange }) {
    const wrap = document.createElement('label');
    wrap.className = 'field field--checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(getByPath(character, field));
    input.addEventListener('change', () => {
      setByPath(character, field, input.checked);
      onChange?.();
    });
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(input);
    wrap.appendChild(span);
    container.appendChild(wrap);
  },
});

registerFieldType('select', {
  render(container, { character, field, label, options = [], onChange }) {
    const wrap = fieldWrapper(label);
    const select = document.createElement('select');
    options.forEach((opt) => {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value ?? opt;
      optionEl.textContent = opt.label ?? opt;
      select.appendChild(optionEl);
    });
    select.value = getByPath(character, field) ?? '';
    select.addEventListener('change', () => {
      setByPath(character, field, select.value);
      onChange?.();
    });
    wrap.appendChild(select);
    container.appendChild(wrap);
  },
});

// Campo composto: valor atual/máximo (ex: pontos de vida, energia, munição...).
registerFieldType('resource', {
  render(container, { character, field, label, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const current = document.createElement('input');
    current.type = 'number';
    current.value = getByPath(character, `${field}.current`) ?? 0;
    current.addEventListener('input', () => {
      setByPath(character, `${field}.current`, current.value === '' ? 0 : Number(current.value));
      onChange?.();
    });

    const sep = document.createElement('span');
    sep.textContent = '/';

    const max = document.createElement('input');
    max.type = 'number';
    max.value = getByPath(character, `${field}.max`) ?? 0;
    max.addEventListener('input', () => {
      setByPath(character, `${field}.max`, max.value === '' ? 0 : Number(max.value));
      onChange?.();
    });

    row.append(current, sep, max);
    wrap.appendChild(row);
    container.appendChild(wrap);
  },
});
