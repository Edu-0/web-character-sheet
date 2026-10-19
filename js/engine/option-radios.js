// A single textual choice, including an explicit manual option. No writes on mount.
export function createOptionRadios({label, options, value, onChange}) {
  const group = document.createElement('fieldset');
  group.className = 'engine-option-radios';
  const legend = document.createElement('legend'); legend.textContent = label; group.append(legend);
  const name = 'entry-choice-' + crypto.randomUUID(), controls = [];
  const manual = options.find(option => option.value === '') || {value: '', label: 'Ajuste manual'};
  const feedback = document.createElement('small'); feedback.setAttribute('role', 'status');
  const update = next => {
    const selected = String(next ?? '');
    controls.forEach(control => { control.checked = control.value === selected; });
    feedback.hidden = controls.some(control => control.checked);
    feedback.textContent = feedback.hidden ? '' : `Valor atual fora destas opções: ${selected}. Escolha uma opção para alterar.`;
  };
  for (const option of [...options.filter(option => option.value !== ''), manual]) {
    const wrap = document.createElement('label'); wrap.className = 'field field--radio';
    const control = document.createElement('input'); control.type = 'radio'; control.name = name; control.value = option.value;
    const text = document.createElement('span'); text.textContent = option.label;
    control.addEventListener('change', () => { if (control.checked) { update(control.value); onChange(control.value); } });
    controls.push(control); wrap.append(control, text); group.append(wrap);
  }
  group.append(feedback); update(value);
  return {element: group, update};
}
