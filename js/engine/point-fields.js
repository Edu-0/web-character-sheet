import { registerFieldType } from './fields.js';
import { getByPath, setByPath } from './paths.js';
import { closeCreation, evolutionTargets, pointBudget, stepCost } from './point-budget.js';
import { parseTrait, traitDice, traitLabel, traitMaximum } from './traits.js';
import { evaluate } from './formula.js';

registerFieldType('pointBudget', {
  search(context) {
    const config = getByPath(context.system, context.configFrom || 'pointBudget');
    if (!config) return [];
    const budget = pointBudget(context.character, context.system, config);
    return [
      { label: 'Pontos de criação', value: budget.creation.available },
      { label: 'Gastos na criação', value: budget.creation.spent },
      { label: 'Saldo de criação', value: budget.creation.remaining },
      { label: 'Evolução recebida', value: budget.evolution.awarded },
      { label: 'Gastos na evolução', value: budget.evolution.spent },
      { label: 'Saldo de evolução', value: budget.evolution.remaining },
      ...budget.history.map((entry) => ({ label: entry.description, value: `${entry.cost} pontos · ${entry.source === 'points' ? 'Paga' : 'Narrativa / livre'}` })),
    ];
  },
  render(container, context) {
    const config = getByPath(context.system, context.configFrom || 'pointBudget');
    if (!config) return;
    const wrap = node('div', 'engine-budget');
    const status = node('p', 'engine-budget__status');
    const metrics = node('div', 'engine-budget__metrics');
    const outputs = new Map();
    for (const [key, label] of [['available', 'Pontos de criação'], ['spent', 'Gastos na criação'], ['remaining', 'Saldo de criação'], ['awarded', 'Evolução recebida'], ['evolutionSpent', 'Gastos na evolução'], ['evolutionRemaining', 'Saldo de evolução']]) {
      const metric = node('div', 'engine-budget__metric');
      const output = node('output');
      output.setAttribute('aria-label', label);
      outputs.set(key, output);
      metric.append(node('span', '', label), output);
      metrics.appendChild(metric);
    }
    (config.modifiers || []).forEach((modifier, index) => {
      const metric = node('div', 'engine-budget__metric');
      const output = node('output');
      output.setAttribute('aria-label', `Total de ${modifier.label}`);
      outputs.set(`modifier:${index}`, output);
      metric.append(node('span', '', `Total de ${modifier.label}`), output);
      metrics.appendChild(metric);
    });
    const feedback = node('p', 'engine-budget__feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-label', 'Avisos de progressão');
    const complete = button('Concluir criação', 'button button--primary');
    const reopen = button('Reabrir criação', 'button button--ghost');
    const phaseActions = node('div', 'engine-budget__actions');
    phaseActions.append(complete, reopen);

    const form = node('div', 'engine-budget__evolution');
    form.append(node('h3', '', 'Registrar evolução'));
    const target = document.createElement('select');
    const die = document.createElement('select');
    (context.system.dieScale || []).forEach((value) => die.appendChild(option(String(value), `d${value}`)));
    const compositeOption = option('composite', 'Traço composto / Ascensão');
    die.appendChild(compositeOption);
    const composition = document.createElement('input');
    composition.type = 'text';
    composition.placeholder = 'd12 + d6';
    composition.setAttribute('aria-label', 'Novo traço composto');
    const compositionField = label('Novo traço composto', composition);
    const source = document.createElement('select');
    source.append(option('narrative', 'Narrativa / gratuita'), option('points', 'Paga com pontos'));
    const cost = document.createElement('input');
    cost.type = 'number';
    cost.min = '0';
    cost.step = '1';
    cost.value = '0';
    const description = document.createElement('input');
    description.type = 'text';
    description.placeholder = 'Treinamento, descoberta ou melhoria';
    const controls = node('div', 'engine-budget__controls');
    controls.append(label('Traço a evoluir', target), label('Novo dado', die), compositionField, label('Origem da evolução', source), label('Custo em pontos', cost), label('Descrição da evolução', description));
    const add = button('Registrar evolução', 'button button--primary');
    form.append(controls, node('p', 'engine-section__note', 'A evolução narrativa custa 0 pontos. Para compras sem tabela de custo, informe o valor combinado com a mesa.'), add);
    const history = node('div', 'engine-budget__history');
    const undo = button('Desfazer última evolução', 'button button--ghost');
    let targets = [];
    let targetsSignature = '';
    const selectedTarget = () => targets.find((item) => item.key === target.value);
    const chosenValue = () => die.value === 'composite' ? parseTrait(composition.value, context.system.dieScale || []) : Number(die.value);
    const setCurrentDie = () => {
      const value = selectedTarget()?.die || context.system.dieScale?.[0];
      die.value = typeof value === 'object' ? 'composite' : String(value);
      composition.value = typeof value === 'object' ? traitLabel(value) : `d${value} + d6`;
    };
    const suggestCost = () => {
      const item = selectedTarget();
      die.disabled = !item;
      compositeOption.disabled = !item?.allowComposite;
      compositionField.hidden = die.value !== 'composite';
      cost.disabled = source.value === 'narrative';
      let suggested = item ? stepCost(item.die, chosenValue(), context.system.dieScale || [], item.costs) : null;
      if (item && traitDice(item.die).length > 1 && (config.postAscension?.enabledField && getByPath(context.character, config.postAscension.enabledField)) && config.postAscension?.formulaFrom) {
        const previous = pointBudget(context.character, context.system, config).history.filter((event) => event.targetKey === item.key && traitDice(event.from).length > 1).length;
        suggested = evaluate(getByPath(context.system, config.postAscension.formulaFrom), { vars: { n: previous + 1 } });
      }
      cost.value = source.value === 'narrative' ? '0' : (suggested === null ? '' : String(suggested));
    };
    target.addEventListener('change', () => {
      setCurrentDie();
      suggestCost();
    });
    die.addEventListener('change', suggestCost);
    composition.addEventListener('input', suggestCost);
    source.addEventListener('change', suggestCost);

    const refresh = () => {
      const budget = pointBudget(context.character, context.system, config);
      status.textContent = budget.phase === 'creation' ? 'Criação em andamento · os gastos acompanham suas escolhas' : 'Em jogo · criação concluída, evoluções registradas separadamente';
      const values = { ...budget.creation, awarded: budget.evolution.awarded, evolutionSpent: budget.evolution.spent, evolutionRemaining: budget.evolution.remaining };
      (config.modifiers || []).forEach((modifier, index) => { const value = budget.creation.modifiers.find((item) => item.field === modifier.field); values[`modifier:${index}`] = (value?.total || 0) * modifier.sign; });
      outputs.forEach((output, key) => {
        output.textContent = String(values[key]);
        output.classList.toggle('engine-budget__value--negative', values[key] < 0);
      });
      complete.hidden = budget.phase !== 'creation';
      complete.disabled = budget.creation.remaining < 0 || budget.creation.issues.length > 0;
      reopen.hidden = budget.phase === 'creation';
      reopen.disabled = budget.history.length > 0;
      reopen.title = budget.history.length ? 'A criação já possui evoluções posteriores.' : 'Corrigir as escolhas iniciais antes de registrar evoluções.';
      form.hidden = budget.phase === 'creation';
      feedback.textContent = budget.creation.issues.join(' ') || (budget.creation.remaining < 0 ? 'Os gastos ultrapassam os pontos de criação disponíveis.' : '');
      const next = evolutionTargets(context.character, context.system, config);
      const signature = JSON.stringify(next);
      if (signature !== targetsSignature) {
        const selected = target.value;
        targets = next;
        targetsSignature = signature;
        target.replaceChildren(option('', 'Outro / registro livre'));
        targets.forEach((item) => target.appendChild(option(item.key, `${item.label} · ${traitLabel(item.die)}`)));
        if (targets.some((item) => item.key === selected)) target.value = selected;
        setCurrentDie();
        suggestCost();
      }
      history.replaceChildren(node('h3', '', 'Histórico de evolução'));
      if (!budget.history.length) history.appendChild(node('p', 'engine-empty', 'Nenhuma evolução registrada.'));
      budget.history.forEach((entry) => {
        const row = node('div', 'engine-budget__event');
        row.append(node('strong', '', entry.description), node('span', '', entry.source === 'points' ? `${entry.cost} pontos` : 'Narrativa · 0 pontos'));
        history.appendChild(row);
      });
      undo.hidden = budget.history.length === 0;
      history.appendChild(undo);
    };
    complete.addEventListener('click', () => {
      const snapshot = closeCreation(context.character, context.system, config);
      if (!snapshot) return;
      setByPath(context.character, `${config.field}.creation`, snapshot);
      setByPath(context.character, `${config.field}.phase`, 'play');
      context.onChange?.();
    });
    reopen.addEventListener('click', () => {
      if (pointBudget(context.character, context.system, config).history.length) return;
      setByPath(context.character, `${config.field}.phase`, 'creation');
      context.onChange?.();
    });
    add.addEventListener('click', () => {
      const budget = pointBudget(context.character, context.system, config);
      if (budget.phase !== 'play') return;
      const item = selectedTarget();
      const newDie = chosenValue();
      const paid = source.value === 'points';
      const points = paid && cost.value !== '' ? Number(cost.value) : paid ? NaN : 0;
      if (!Number.isInteger(points) || points < 0) {
        feedback.textContent = 'Informe um custo inteiro e não negativo para esta compra.';
        return;
      }
      if (paid && points > budget.evolution.remaining) {
        feedback.textContent = 'Pontos de evolução insuficientes para esta compra.';
        return;
      }
      if (item && (!newDie || (typeof newDie === 'object' && !item.allowComposite) || traitMaximum(newDie) <= traitMaximum(item.die))) {
        feedback.textContent = 'Escolha um dado maior que o atual para registrar a evolução.';
        return;
      }
      const detail = description.value.trim() || (item ? `${item.label}: ${traitLabel(item.die)} → ${traitLabel(newDie)}` : '');
      if (!detail) {
        feedback.textContent = 'Descreva a evolução que será registrada.';
        return;
      }
      const entries = getByPath(context.character, `${config.field}.history`) || [];
      entries.push({ id: crypto.randomUUID(), date: new Date().toISOString(), description: detail, source: source.value, cost: points, ...(item ? { targetKey: item.key, field: item.field, from: structuredClone(item.die), to: structuredClone(newDie) } : {}) });
      setByPath(context.character, `${config.field}.history`, entries);
      if (item) setByPath(context.character, item.field, newDie);
      description.value = '';
      context.onChange?.();
    });
    undo.addEventListener('click', () => {
      const entries = getByPath(context.character, `${config.field}.history`) || [];
      const last = entries.at(-1);
      if (!last) return;
      const affected = last.targetKey ? evolutionTargets(context.character, context.system, config).find((item) => item.key === last.targetKey) : null;
      if (last.targetKey && (!affected || JSON.stringify(getByPath(context.character, affected.field)) !== JSON.stringify(last.to))) {
        feedback.textContent = 'O traço foi alterado depois dessa evolução. Ajuste-o ao dado registrado antes de desfazer.';
        return;
      }
      if (affected) setByPath(context.character, affected.field, last.from);
      entries.pop();
      context.onChange?.();
    });
    wrap.append(status, metrics, feedback, phaseActions, form, history);
    refresh();
    suggestCost();
    context.registerRefresh?.(refresh);
    container.appendChild(wrap);
  },
});

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function option(value, text) {
  const element = node('option', '', text);
  element.value = value;
  return element;
}

function label(text, control) {
  const element = node('label', 'field');
  control.setAttribute('aria-label', text);
  element.append(node('span', '', text), control);
  return element;
}

function button(text, className) {
  const element = node('button', className, text);
  element.type = 'button';
  return element;
}
