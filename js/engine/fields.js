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
  render(container, { character, field, label, placeholder, onChange }) {
    const wrap = fieldWrapper(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getByPath(character, field) ?? '';
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('input', () => {
      setByPath(character, field, input.value);
      onChange?.();
    });
    wrap.appendChild(input);
    container.appendChild(wrap);
  },
});

registerFieldType('textarea', {
  render(container, { character, field, label, rows = 3, onChange }) {
    const wrap = fieldWrapper(label);
    const textarea = document.createElement('textarea');
    textarea.rows = rows;
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
    row.className = 'engine-resource';

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

// Campo de "Traço baseado em dado" (ex.: Atributo/Perícia de d4 a d12). Genérico:
// a escala de opções vem de engine/die-scale.js (configurada pelo system.json),
// não é fixada aqui. Usado por qualquer sistema baseado em dados por Traço.
registerFieldType('die', {
  render(container, { character, field, label, onChange, dieScale = [4, 6, 8, 10, 12] }) {
    const wrap = fieldWrapper(label);
    const select = document.createElement('select');
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = '—';
    select.appendChild(noneOption);
    dieScale.forEach((sides) => {
      const option = document.createElement('option');
      option.value = sides;
      option.textContent = `d${sides}`;
      select.appendChild(option);
    });
    const current = getByPath(character, field);
    select.value = current ?? '';
    select.addEventListener('change', () => {
      setByPath(character, field, select.value === '' ? null : Number(select.value));
      onChange?.();
    });
    wrap.appendChild(select);
    container.appendChild(wrap);
  },
});

// Contador genérico com +/- (ex.: Recurso de Ação, Reação, qualquer "ficha de uso").
registerFieldType('counter', {
  render(container, { character, field, label, onChange, min = 0, max = Infinity }) {
    const wrap = fieldWrapper(label);
    const row = document.createElement('div');
    row.className = 'engine-counter';

    const value = document.createElement('span');
    value.className = 'computed';
    const current = () => Number(getByPath(character, field)) || 0;
    const refresh = () => { value.textContent = String(current()); };

    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'engine-counter__button';
    decBtn.setAttribute('aria-label', `Reduzir ${label}`);
    decBtn.textContent = '−';
    decBtn.addEventListener('click', () => {
      setByPath(character, field, Math.max(min, current() - 1));
      refresh();
      onChange?.();
    });

    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'engine-counter__button';
    incBtn.setAttribute('aria-label', `Aumentar ${label}`);
    incBtn.textContent = '+';
    incBtn.addEventListener('click', () => {
      setByPath(character, field, Math.min(max, current() + 1));
      refresh();
      onChange?.();
    });

    refresh();
    row.append(decBtn, value, incBtn);
    wrap.appendChild(row);
    container.appendChild(wrap);
  },
});
