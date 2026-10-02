import { escapeHtml } from './escape-html.js';
// dice-pool-test.js
// Prova real de generalidade: monta Pools, resolve Ápice/Base/Peso/Potência,
// calcula Dificuldade e resolve com d20 — tudo através dos módulos genéricos do
// engine, configurados por sistema-rpg.system.json.
import { loadSystem, getSystem } from './engine/system.js';
import { rollPool, resolvePool, potencyOptions } from './engine/pool.js';
import { resolveAction } from './engine/resolution.js';
import { resolve } from './engine/dice-resolver.js';
import { stepUp } from './engine/die-scale.js';
import { applyEffectToGradedState } from './engine/graded-state.js';

let system = null;
let character = null;
let lastActorPoolResult = null;

async function main() {
  system = await loadSystem('./data/systems/sistema-rpg.system.json');
  character = await fetch('./data/characters/sistema-rpg.example.character.json').then((r) => r.json());

  renderCharacterSummary();
  buildTraitChecklist();
  buildOppositionPresets();
  renderEnergyCostTable();
  wireButtons();
}

function labelFor(key) {
  return system.attributes.find((a) => a.key === key)?.label ?? key;
}

function renderCharacterSummary() {
  const el = document.getElementById('character-summary');
  const attrs = Object.entries(character.attributes).map(([k, v]) => `${labelFor(k)}: d${v}`).join(' · ');
  const skills = Object.entries(character.skills).map(([k, v]) => `${k}: d${v}`).join(' · ');
  el.innerHTML = `
    <p><strong>${escapeHtml(character.name)}</strong> — ${escapeHtml(character.origin)}</p>
    <p>Atributos: ${escapeHtml(attrs)}</p>
    <p>Dado de Existência: d${escapeHtml(character.existenceDie)}</p>
    <p>Perícias: ${escapeHtml(skills)}</p>
    <p>Especializações: ${escapeHtml(character.specializations.map((s) => `${s.name} (d${s.die})`).join(', '))}</p>
    <p>Essências: ${escapeHtml(character.essences.map((e) => `${e.name} (d${e.die})`).join(', '))}</p>
    <p>Técnicas: ${escapeHtml(character.techniques.map((t) => `${t.name} (d${t.currentDie})`).join(', '))}</p>
    <p>Energia: ${escapeHtml(character.resources.energy.current)}/${escapeHtml(character.resources.energy.max)} · RA: ${escapeHtml(character.resources.actionResource.current)}</p>
  `;
}

function collectAvailableTraits() {
  const traits = [];
  system.attributes.forEach((a) => {
    const sides = character.attributes[a.key];
    if (sides) traits.push({ source: `attribute:${a.key}`, label: `${a.label} (Atributo)`, sides });
  });
  traits.push({ source: 'existence', label: 'Dado de Existência', sides: character.existenceDie });
  Object.entries(character.skills).forEach(([name, sides]) => {
    traits.push({ source: `skill:${name}`, label: `${name} (Perícia)`, sides });
  });
  character.specializations.forEach((s) => {
    traits.push({ source: `spec:${s.id}`, label: `${s.name} (Especialização)`, sides: s.die });
  });
  character.essences.forEach((e) => {
    traits.push({ source: `essence:${e.id}`, label: `${e.name} (Essência)`, sides: e.die });
  });
  character.techniques.forEach((t) => {
    traits.push({ source: `tech:${t.id}`, label: `${t.name} (Técnica)`, sides: t.currentDie });
  });
  return traits;
}

function buildTraitChecklist() {
  const container = document.getElementById('trait-checklist');
  container.innerHTML = '';
  collectAvailableTraits().forEach((trait) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.source = trait.source;
    checkbox.dataset.sides = trait.sides;
    checkbox.dataset.label = trait.label;
    label.appendChild(checkbox);
    label.append(` ${trait.label} — d${trait.sides}`);
    container.appendChild(label);
  });
}

function buildOppositionPresets() {
  const select = document.getElementById('opposition-preset');
  select.innerHTML = '';
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '— usar peso manual —';
  select.appendChild(noneOpt);
  (system.opposition?.passivePresets || []).forEach((preset) => {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = `${preset.label} (${preset.dice.map((s) => `d${s}`).join('+')})`;
    select.appendChild(opt);
  });
}

function renderPoolResult(poolResult, containerId) {
  const el = document.getElementById(containerId);
  const rollsHtml = poolResult.rolls.map((r) => {
    let badge = '';
    if (poolResult.apex === r) badge = '<span class="result-badge apex">Ápice</span>';
    else if (poolResult.base === r) badge = '<span class="result-badge base">Base</span>';
    return `<li>${escapeHtml(r.label || r.source)} — d${escapeHtml(r.sides)}${r.composite ? ' (Composto)' : ''} = ${escapeHtml(r.result)} ${badge}</li>`;
  }).join('');
  el.innerHTML = `
    <ul>${rollsHtml}</ul>
    <p>Peso = Ápice (${poolResult.apex?.result ?? '—'}) + Base (${poolResult.base?.result ?? '—'}) = <strong>${poolResult.weight}</strong></p>
  `;
  return el;
}

function renderEnergyCostTable() {
  const table = system.energyCostByDie;
  const scale = [0, ...system.dieScale];
  const lines = scale.map((sides) => {
    const cost = table[String(sides)];
    return `d${sides} → ${cost === undefined ? 'indefinido (não especificado pela documentação)' : `${cost} de Energia`}`;
  });
  document.getElementById('energy-cost-output').textContent = lines.join('\n');
}

function wireButtons() {
  document.getElementById('btn-roll-pool').addEventListener('click', () => {
    const selected = [...document.querySelectorAll('#trait-checklist input:checked')].map((cb) => ({
      source: cb.dataset.source,
      label: cb.dataset.label,
      sides: Number(cb.dataset.sides),
    }));
    lastActorPoolResult = selected.length ? rollPool(selected) : resolvePool([]);
    const el = renderPoolResult(lastActorPoolResult, 'pool-result');
    if (lastActorPoolResult.emptyPool) {
      el.innerHTML += '<p><strong>Pool vazia → falha automática.</strong></p>';
      return;
    }
    const options = potencyOptions(lastActorPoolResult, system.dieScale[0]);
    const selectHtml = options.map((o) => `<option value="${o.sides}">d${o.sides}${o.source ? ` (${escapeHtml(o.source)})` : ' (forçado)'}</option>`).join('');
    el.innerHTML += `<label class="field"><span>Potência</span><select id="potency-choice">${selectHtml}</select></label>`;
  });

  document.getElementById('btn-resolve').addEventListener('click', () => {
    const resultEl = document.getElementById('resolution-result');
    if (!lastActorPoolResult || lastActorPoolResult.emptyPool) {
      resultEl.innerHTML = '<p>Monte e role uma Pool do personagem primeiro (Pool vazia = falha automática, sem Dificuldade a calcular).</p>';
      return;
    }
    const presetId = document.getElementById('opposition-preset').value;
    const manual = document.getElementById('opponent-weight-manual').value;
    let opponentWeight;
    let oppositionDetail;
    if (manual !== '') {
      opponentWeight = Number(manual);
      oppositionDetail = `Peso manual informado: ${opponentWeight}`;
    } else if (presetId) {
      const preset = system.opposition.passivePresets.find((p) => p.id === presetId);
      const oppRolls = resolve({ type: 'dicePool', dice: preset.dice.map((s) => ({ sides: s })) });
      const oppPool = resolvePool(oppRolls.rolls.map((r) => ({ ...r, source: 'opposition' })));
      opponentWeight = oppPool.weight;
      oppositionDetail = `${escapeHtml(preset.label)}: rolagens [${oppRolls.rolls.map((r) => r.result).join(', ')}] → Peso ${opponentWeight}`;
    } else {
      resultEl.innerHTML = '<p>Escolha um preset de oposição ou informe um peso manual.</p>';
      return;
    }

    const outcome = resolveAction(lastActorPoolResult.weight, opponentWeight);
    let extra = '';
    if (outcome.outcome === 'criticalSuccess') {
      const potencySelect = document.getElementById('potency-choice');
      const potencySides = potencySelect ? Number(potencySelect.value) : system.dieScale[0];
      const step = stepUp(potencySides);
      extra = step.overflow
        ? `<p>Potência já em d${potencySides}: <strong>Potência Excepcional (d${potencySides} + 1 Ascensão)</strong>.</p>`
        : `<p>Potência Aprimorada: d${potencySides} → <strong>d${step.sides}</strong>.</p>`;
    }

    resultEl.innerHTML = `
      <p>${oppositionDetail}</p>
      <p>Peso do personagem: <strong>${lastActorPoolResult.weight}</strong> · Peso da oposição: <strong>${opponentWeight}</strong></p>
      <p>Dificuldade = 10 + ${opponentWeight} − ${lastActorPoolResult.weight} = <strong>${outcome.difficulty}</strong></p>
      <p>${outcome.rolled ? `d20 = ${outcome.d20}` : 'Sem rolagem de d20 (resultado automático pela Dificuldade)'}</p>
      <p>Resultado: <strong>${outcome.outcome}</strong> (${outcome.success ? 'sucesso' : 'falha'})</p>
      ${extra}
    `;
  });

  document.getElementById('btn-tie-example').addEventListener('click', () => {
    const rolls = [
      { source: 'd12', sides: 12, result: 8 },
      { source: 'd10', sides: 10, result: 8 },
      { source: 'd6', sides: 6, result: 4 },
    ];
    const result = resolvePool(rolls);
    document.getElementById('tie-output').textContent =
      `Ápice: ${result.apex.source} (d${result.apex.sides}) = ${result.apex.result}\n` +
      `Base: ${result.base.source} (d${result.base.sides}) = ${result.base.result}\n` +
      `Peso: ${result.weight}\n` +
      `Restante para Potência: ${result.remaining.map((r) => `${r.source} (d${escapeHtml(r.sides)})`).join(', ')}`;
  });

  document.getElementById('btn-empty-pool').addEventListener('click', () => {
    const result = resolvePool([]);
    document.getElementById('empty-output').textContent = JSON.stringify(result, null, 2);
  });

  document.getElementById('btn-composite').addEventListener('click', () => {
    const result = resolve({ type: 'trait', source: 'forca-composta', dice: [{ sides: 12 }, { sides: 6 }], label: 'Força (Traço Composto)' });
    document.getElementById('composite-output').textContent =
      `${result.formula}: [${result.rolls.map((r) => r.result).join(' + ')}] = ${result.result} (uma única fonte, composite=${result.composite})`;
  });

  document.getElementById('btn-state-upgrade').addEventListener('click', () => {
    const potencySides = Number(document.getElementById('potency-vs-state').value);
    const result = applyEffectToGradedState(8, potencySides);
    document.getElementById('state-output').textContent =
      `Ferido d8 + Potência d${potencySides} → Ferido ${result.changed ? `d${result.sides}` : 'd8 (sem alteração)'} (modo: ${result.mode})`;
  });
}

main().catch((err) => {
  const message = document.createElement('p'); message.textContent = `Erro: ${err.message}`; message.style.color = 'red'; document.body.prepend(message);
  console.error(err);
});
