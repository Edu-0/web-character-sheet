// Um traço permanece uma única fonte na Pool, mesmo com vários dados internos.
export function traitDice(value) {
  const dice = typeof value === 'number' ? [value] : value?.dice?.map((die) => typeof die === 'number' ? die : die.sides) || [];
  return dice.filter((sides) => Number.isInteger(sides) && sides > 0);
}

export function traitMaximum(value) {
  return traitDice(value).reduce((sum, sides) => sum + sides, 0);
}

export function traitLabel(value) {
  return traitDice(value).map((sides) => `d${sides}`).join(' + ') || '—';
}

export function parseTrait(text, scale) {
  const tokens = text.trim().split(/\s*\+\s*/);
  if (!tokens.length || tokens.some((token) => !/^d?\d+$/.test(token))) return null;
  const dice = tokens.map((token) => Number(token.replace(/^d/, '')));
  if (dice.some((sides) => !scale.includes(sides))) return null;
  return dice.length === 1 ? dice[0] : { dice: dice.map((sides) => ({ sides })) };
}

export function shiftTrait(value, steps, scale, ascensionStart = 6) {
  const dice = traitDice(value);
  for (let count = 0; count < Math.abs(steps); count += 1) {
    const last = dice.length - 1;
    const index = scale.indexOf(dice[last]);
    if (index < 0) break;
    if (steps > 0) {
      if (index === scale.length - 1) dice.push(ascensionStart);
      else dice[last] = scale[index + 1];
    } else if (index > 0) dice[last] = scale[index - 1];
  }
  return dice.length === 1 ? dice[0] : { dice: dice.map((sides) => ({ sides })) };
}

export function traitDescriptor(value) {
  const dice = traitDice(value);
  return dice.length === 1 ? { sides: dice[0] } : { dice: dice.map((sides) => ({ sides })) };
}

export function createTraitControl(value, onChange, { label, scale, allowComposite = false, allowNone = true }) {
  const wrap = document.createElement('div');
  wrap.className = 'engine-trait-control';
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);
  const add = (value, text) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  };
  if (allowNone) add('', '—');
  scale.forEach((sides) => add(String(sides), `d${sides}`));
  if (allowComposite) add('composite', 'Traço composto');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'd12 + d6';
  input.setAttribute('aria-label', `Composição de ${label}`);
  const error = document.createElement('small');
  error.className = 'engine-budget__feedback';
  const update = (current) => {
    value = current;
    select.value = current && typeof current === 'object' ? 'composite' : String(current ?? '');
    input.hidden = select.value !== 'composite';
    if (document.activeElement !== input) input.value = traitLabel(current);
  };
  select.addEventListener('change', () => {
    input.hidden = select.value !== 'composite';
    error.textContent = '';
    if (select.value === 'composite') {
      input.value = `${traitLabel(value) === '—' ? `d${scale.at(-1)}` : traitLabel(value)} + d${scale[1] || scale[0]}`;
      const parsed = parseTrait(input.value, scale);
      if (parsed) { value = parsed; onChange(parsed); }
      input.focus();
    } else {
      value = select.value ? Number(select.value) : null;
      onChange(value);
    }
  });
  input.addEventListener('input', () => {
    const parsed = parseTrait(input.value, scale);
    error.textContent = parsed ? '' : 'Use dados da escala separados por +.';
    input.setAttribute('aria-invalid', String(!parsed));
    if (parsed) { value = parsed; onChange(parsed); }
  });
  update(value);
  wrap.appendChild(select);
  if (allowComposite) wrap.append(input, error);
  return { element: wrap, update };
}
