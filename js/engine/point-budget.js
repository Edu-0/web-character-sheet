import { getByPath } from './paths.js';
import { traitMaximum } from './traits.js';

// Custos e campos são declarados pelo sistema. Dados atuais servem para a
// criação; depois dela, o retrato inicial e os lançamentos são independentes.
export function stepCost(from, to, scale, costs) {
  if (from === to) return 0;
  const ladder = [0, ...scale.filter((value) => value !== 0)];
  const start = ladder.indexOf(from);
  const end = ladder.indexOf(to);
  if (start < 0 || end < start) return null;
  let total = 0;
  for (let index = start; index < end; index += 1) {
    const cost = costs?.[`${ladder[index]}->${ladder[index + 1]}`];
    if (!Number.isFinite(cost) || cost < 0) return null;
    total += cost;
  }
  return total;
}

export function pointBudget(character, system, config) {
  const phase = getByPath(character, `${config.field}.phase`) || 'creation';
  const saved = getByPath(character, `${config.field}.creation`);
  const preset = (getByPath(system, config.presetsFrom || 'qualityPresets') || []).find((item) => item.id === getByPath(character, config.qualityField));
  let creation = { available: (preset?.points || 0) + (Number(getByPath(character, config.adjustmentField)) || 0), spent: 0, issues: [] };
  creation.modifiers = (config.modifiers || []).map((source) => {
    const entries = getByPath(character, source.field) || [];
    let total = 0;
    entries.forEach((entry) => {
      const points = Number(entry?.[source.valueField] ?? 0);
      if (!Number.isInteger(points) || points < 0) creation.issues.push(`${source.label}: os pontos precisam ser inteiros e não negativos.`);
      else total += points;
    });
    creation.available += total * source.sign;
    return { field: source.field, label: source.label, total, sign: source.sign };
  });
  if (phase === 'play' && saved) {
    creation = { available: saved.available, spent: saved.spent, modifiers: saved.modifiers || [], issues: [] };
  } else {
    if (!preset) creation.issues.push('Escolha uma Qualidade válida.');
    (config.sources || []).forEach((source) => {
      const data = getByPath(character, source.field) || (source.kind === 'map' ? {} : []);
      const entries = source.kind === 'map' ? Object.entries(data).map(([name, die]) => ({ name, die })) : data;
      entries.forEach((entry) => {
        const label = entry.name || source.label || source.field;
        if (source.costField) {
          const cost = Number(entry[source.costField] || 0);
          if (!Number.isInteger(cost) || cost < 0) creation.issues.push(`${label}: informe um custo de criação inteiro e não negativo.`);
          else creation.spent += cost;
          return;
        }
        const die = entry[source.valueField || 'die'] || source.baseDie;
        const cost = source.countCreation === false ? 0 : stepCost(source.baseDie, die, system.dieScale || [], getByPath(system, source.costsFrom));
        if (cost === null) creation.issues.push(`${label}: a campanha precisa definir o custo desse dado.`);
        else creation.spent += cost;
        if (source.limitByQuality && preset?.maxDie && traitMaximum(die) > preset.maxDie) {
          creation.issues.push(`${label}: o dado ultrapassa o teto inicial d${preset.maxDie}.`);
        }
      });
    });
  }
  creation.remaining = creation.available - creation.spent;
  const history = getByPath(character, `${config.field}.history`) || [];
  const awarded = Number(getByPath(character, config.evolutionField)) || 0;
  const spent = history.reduce((total, entry) => total + (entry.source === 'points' ? Number(entry.cost) || 0 : 0), 0);
  return { phase, creation, evolution: { awarded, spent, remaining: awarded - spent }, history };
}

export function closeCreation(character, system, config) {
  const budget = pointBudget(character, system, config);
  if (budget.phase !== 'creation' || budget.creation.issues.length || budget.creation.remaining < 0) return null;
  return {
    available: budget.creation.available,
    spent: budget.creation.spent,
    quality: getByPath(character, config.qualityField),
    modifiers: structuredClone(budget.creation.modifiers),
    allocations: Object.fromEntries([...(config.sources || []), ...(config.modifiers || [])].map((source) => [source.field, structuredClone(getByPath(character, source.field) || null)])),
    completedAt: new Date().toISOString(),
  };
}

export function evolutionTargets(character, system, config) {
  return (config.sources || []).flatMap((source) => {
    const data = getByPath(character, source.field) || (source.kind === 'map' ? {} : []);
    const catalog = source.catalogFrom ? (getByPath(system, source.catalogFrom) || []).flatMap((category) => category.skills || []) : [];
    const entries = source.kind === 'map'
      ? [...new Set([...catalog, ...Object.keys(data)])].map((name) => ({ name, die: data[name] ?? source.baseDie }))
      : data;
    const labels = source.labelsFrom ? getByPath(system, source.labelsFrom) || [] : [];
    return entries.map((entry, index) => ({
      key: `${source.field}:${source.kind === 'map' ? entry.name : entry.id || index}`,
      field: source.kind === 'map' ? `${source.field}.${entry.name}` : `${source.field}.${index}.${source.evolutionValueField || source.valueField || 'die'}`,
      label: labels.find((label) => label.key === entry.name)?.label || entry.name || `${source.label || source.field} ${index + 1}`,
      die: entry[source.evolutionValueField || source.valueField || 'die'] || source.baseDie || system.dieScale?.[0],
      allowComposite: source.allowComposite === true,
      costs: getByPath(system, source.costsFrom || '') || {},
    }));
  });
}
