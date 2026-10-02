// Uma escolha opcional, apresentada em caixas. Marcar outra substitui a anterior.
export function createOptionCheckboxes({ label, options, value, onChange }) {
  const group = document.createElement('fieldset');
  group.className = 'engine-option-checkboxes';
  const legend = document.createElement('legend'); legend.textContent = label;
  group.append(legend);
  const controls = [];
  const update = next => controls.forEach(control => { control.checked = control.value === String(next ?? ''); });
  for (const option of options.filter(option => option.value !== '')) {
    const wrap = document.createElement('label'); wrap.className = 'field field--checkbox';
    const control = document.createElement('input'); control.type = 'checkbox'; control.value = option.value;
    const text = document.createElement('span'); text.textContent = option.label;
    control.addEventListener('change', () => {
      const next = control.checked ? control.value : '';
      update(next); onChange(next);
    });
    controls.push(control); wrap.append(control, text); group.append(wrap);
  }
  const hint = document.createElement('small');
  hint.textContent = 'Escolha uma opção. Sem marcação, ajuste manual.';
  group.append(hint); update(value);
  return { element: group, update };
}
