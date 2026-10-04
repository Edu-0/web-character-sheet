import { registerFieldType } from './fields.js';
import { getByPath } from './paths.js';
import { checkSources, rollCheck } from './checks.js';
import { recordCheck } from '../dice.js';

function el(tag, text = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

registerFieldType('checkRoll', {
  print: () => null,
  search: ({ label }) => [{ label, value: 'Teste sob demanda; decisões e custos manuais' }],
  render(container, { character, system, configFrom, label, registerRefresh }) {
    const config = getByPath(system, configFrom);
    const wrap = el('div'); wrap.className = 'engine-check';
    const controls = el('div'); controls.className = 'engine-check__controls';
    wrap.append(el('h4', label));
    function control(title, input) {
      const field = el('label'); field.className = 'field';
      field.append(el('span', title), input); controls.append(field);
      return input;
    }
    function number(title, value, min = -1000, max = 1000) {
      const input = el('input'); input.type = 'number'; input.value = value;
      input.min = min; input.max = max; input.step = '1';
      return control(title, input);
    }
    const source = control('Fonte do teste', el('select'));
    function refresh() {
      const previous = source.value;
      try {
        source.replaceChildren(...checkSources(config, character, system).map(item => {
          const option = el('option', `${item.label} (${item.error ? 'indisponível' : item.value ?? '—'})`); option.value = item.id; return option;
        }));
        if ([...source.options].some(option => option.value === previous)) source.value = previous;
      } catch (error) {
        source.replaceChildren(el('option', `Fonte indisponível: ${error.message}`));
      }
    }
    refresh(); registerRefresh?.(refresh);
    const percentile = config.algorithm === 'percentile';
    const pool = ['d6Pool', 'd6Resistance'].includes(config.algorithm);
    const modifier = config.algorithm === 'progress' ? null : number(percentile ? 'Dados de bônus (+) / penalidade (−)' : pool ? 'Dados adicionais / penalidade' : 'Modificador do teste', 0, percentile ? -2 : -1000, percentile ? 2 : 1000);
    const target = config.algorithm === 'fate' ? number('Oposição', 0) : config.algorithm === 'explodingTrait' ? number('Número-alvo', 4, 1) : null;
    function checkbox(title, checked) { const input = el('input'); input.type = 'checkbox'; input.checked = checked; return control(title, input); }
    const wild = config.algorithm === 'explodingTrait' ? checkbox('Carta Selvagem (dado selvagem)', true) : null;
    const untrained = config.algorithm === 'explodingTrait' ? checkbox('Não treinado (d4 − 2)', false) : null;
    const button = el('button', 'Rolar teste'); button.type = 'button'; button.className = 'button button--primary';
    const output = el('p'); output.className = 'engine-check__result'; output.setAttribute('role', 'status');
    const hint = el('p', config.note); hint.className = 'engine-note';
    button.addEventListener('click', () => {
      try {
        const selected = checkSources(config, character, system).find(item => item.id === source.value);
        if (!selected) throw new Error('Cadastre e selecione uma fonte para rolar.');
        if (selected.error) throw new Error(`${selected.label}: ${selected.error}`);
        if ((modifier && !modifier.value) || (target && !target.value)) throw new Error('Preencha os valores do teste.');
        const result = rollCheck(config.algorithm, { value: selected.value, modifier: Number(modifier?.value ?? 0), target: Number(target?.value ?? 0), wild: wild?.checked, untrained: untrained?.checked,
          momentum: config.momentumField ? getByPath(character, config.momentumField) : 0 });
        output.textContent = `${selected.label}: ${result.total} · ${result.outcome}. ${result.detail}`;
        const entry = recordCheck({ ...result, label: `${label} · ${selected.label}` });
        document.dispatchEvent(new CustomEvent('sheet:rolled', { detail: entry }));
      } catch (error) { output.textContent = error.message; }
    });
    wrap.append(controls, button, output, hint); container.append(wrap);
  },
});
