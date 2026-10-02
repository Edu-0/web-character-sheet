import { createDiceIllustration } from '../dice-display.js';

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

export function createTraitControl(value, onChange, { label, scale, allowComposite = false, allowNone = true, stepControls = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'engine-trait-control';
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);
  const choice = document.createElement('div');
  choice.className = 'engine-trait-choice';
  const illustration = createDiceIllustration([]);
  const refreshIllustration = (current) => illustration.replaceChildren(...createDiceIllustration(traitDice(current)).childNodes);
  choice.append(illustration, select);
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
  const steps = document.createElement('div');
  steps.className = 'engine-die-steps';
  const refreshSteps = () => {
    const dice = traitDice(value);
    const count = Math.max(1, dice.length);
    // Reutilizar os botões mantém o foco durante a edição e o refresh.
    if (steps.children.length !== count) {
      steps.replaceChildren();
      for (let index = 0; index < count; index += 1) {
        const row = document.createElement('div');
        const caption = document.createElement('span');
        const down = document.createElement('button');
        const up = document.createElement('button');
        for (const [button, delta] of [[down, -1], [up, 1]]) {
          button.type = 'button';
          button.className = 'engine-counter__button';
          button.textContent = delta < 0 ? '−' : '+';
          button.addEventListener('click', () => {
            const currentDice = traitDice(value);
            const at = scale.indexOf(currentDice[index]);
            if (at < 0 || !scale[at + delta]) return;
            currentDice[index] = scale[at + delta];
            const chosen = currentDice.length === 1 ? currentDice[0] : { dice: currentDice.map(sides => ({ sides })) };
            error.textContent = '';
            input.removeAttribute('aria-invalid');
            update(chosen);
            onChange(chosen);
          });
        }
        row.append(down, caption, up);
        steps.append(row);
      }
    }
    [...steps.children].forEach((row, index) => {
      const [down, caption, up] = row.children;
      const at = scale.indexOf(dice[index]);
      const name = dice.length > 1 ? `dado ${index + 1} de ${label}` : label;
      down.setAttribute('aria-label', `Descer ${name}`);
      up.setAttribute('aria-label', `Subir ${name}`);
      down.disabled = at <= 0;
      up.disabled = at < 0 || at >= scale.length - 1;
      down.dataset.intrinsicDisabled = String(down.disabled);
      up.dataset.intrinsicDisabled = String(up.disabled);
      caption.textContent = dice[index] ? `d${dice[index]}` : '—';
    });
  };
  const update = (current) => {
    value = current;
    refreshIllustration(current);
    select.value = current && typeof current === 'object' ? 'composite' : String(current ?? '');
    input.hidden = select.value !== 'composite';
    if (document.activeElement !== input) input.value = traitLabel(current);
    if (stepControls) refreshSteps();
  };
  select.addEventListener('change', () => {
    input.hidden = select.value !== 'composite';
    error.textContent = '';
    if (select.value === 'composite') {
      input.value = `${traitLabel(value) === '—' ? `d${scale.at(-1)}` : traitLabel(value)} + d${scale[1] || scale[0]}`;
      const parsed = parseTrait(input.value, scale);
      if (parsed) { value = parsed; update(value); onChange(parsed); }
      input.focus();
    } else {
      value = select.value ? Number(select.value) : null;
      update(value);
      onChange(value);
    }
  });
  input.addEventListener('input', () => {
    const parsed = parseTrait(input.value, scale);
    error.textContent = parsed ? '' : 'Use dados da escala separados por +.';
    input.setAttribute('aria-invalid', String(!parsed));
    if (parsed) { value = parsed; update(value); onChange(parsed); }
  });
  update(value);
  wrap.appendChild(choice);
  if (stepControls) wrap.appendChild(steps);
  if (allowComposite) wrap.append(input, error);
  return { element: wrap, update };
}
