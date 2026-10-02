import { pathKeys } from './paths.js';

// IDs são chaves literais, nunca caminhos de escrita no personagem.
export function getCalculationOverride(character, key) {
  const overrides = character?.calculationOverrides;
  return overrides && Object.hasOwn(overrides, key) ? overrides[key] : undefined;
}

export function calculationValue(character, key, automatic) {
  const entry = getCalculationOverride(character, key);
  if (!entry) return automatic;
  if (entry.mode === 'fixed') return entry.value;
  return entry.mode === 'adjust' && typeof automatic === 'number' && Number.isFinite(automatic) ? automatic + entry.value : automatic;
}

export function setCalculationOverride(character, key, entry) {
  pathKeys(key);
  if (entry && (!['adjust', 'fixed'].includes(entry.mode) || !Number.isFinite(entry.value))) throw new Error('Ajuste de cálculo inválido.');
  if (!entry) {
    if (character.calculationOverrides) delete character.calculationOverrides[key];
    return;
  }
  character.calculationOverrides ??= {};
  character.calculationOverrides[key] = { ...entry };
}

export function createCalculationControl({ character, key, label, automatic, onChange, registerRefresh }) {
  const details = document.createElement('details');
  details.className = 'engine-calculation-control';
  const summary = document.createElement('summary');
  summary.textContent = `Ajustar ${label}`;
  const status = document.createElement('small');
  status.className = 'engine-calculation-status';
  const base = document.createElement('output');
  const mode = document.createElement('select');
  mode.setAttribute('aria-label', `Modo de cálculo de ${label}`);
  for (const [value, text] of [['auto', 'Automático'], ['adjust', 'Ajuste (+/−)'], ['fixed', 'Valor fixo']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    mode.append(option);
  }
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.setAttribute('aria-label', `Valor manual de ${label}`);
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'button button--ghost';
  reset.textContent = 'Voltar ao automático';
  const feedback = document.createElement('small');
  feedback.setAttribute('role', 'status');
  const refresh = () => {
    const entry = getCalculationOverride(character, key);
    mode.value = entry?.mode || 'auto';
    if (document.activeElement !== input) input.value = String(entry?.value ?? 0);
    input.disabled = !entry;
    reset.disabled = !entry;
    input.dataset.intrinsicDisabled = String(!entry);
    reset.dataset.intrinsicDisabled = String(!entry);
    let value;
    try { value = automatic(); } catch { value = '—'; }
    base.textContent = `Automático: ${value ?? '—'}`;
    status.textContent = entry ? (entry.mode === 'fixed' ? 'Valor fixo' : `Ajuste ${entry.value >= 0 ? '+' : ''}${entry.value}`) : '';
    details.classList.toggle('has-override', Boolean(entry));
  };
  const save = () => {
    if (mode.value !== 'auto' && (input.value === '' || !Number.isFinite(input.valueAsNumber))) {
      feedback.textContent = 'Informe um número válido.';
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    feedback.textContent = '';
    input.removeAttribute('aria-invalid');
    setCalculationOverride(character, key, mode.value === 'auto' ? null : { mode: mode.value, value: input.valueAsNumber });
    refresh();
    onChange?.();
  };
  mode.addEventListener('change', () => {
    if (mode.value !== 'auto' && input.disabled) {
      let value = 0;
      try { if (mode.value === 'fixed') value = automatic() ?? 0; } catch { /* valor editável mesmo sem cálculo */ }
      input.value = String(typeof value === 'number' ? value : 0);
    }
    save();
  });
  input.addEventListener('input', save);
  reset.addEventListener('click', () => { mode.value = 'auto'; save(); });
  summary.append(status);
  details.append(summary, base, mode, input, reset, feedback);
  refresh();
  registerRefresh?.(refresh);
  return details;
}
