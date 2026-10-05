import {EFFECT_LIMITS} from './contracts.js';
import { CHECK_UNITS, EFFECT_EVENTS } from '../engine/effects.js';
import { expandComponents } from '../engine/layout-components.js';
import { pathKeys } from '../engine/paths.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function validateEffectRevisionChange(previous, next) {
  const semantic = def => JSON.stringify([def.stacking,def.group ?? null,def.applicability,def.duration?.type,def.duration?.event ?? null,
    def.operations?.map(op=>[op.type,op.target?.kind,op.target?.key,op.target?.unit ?? null,op.value])]);
  return (previous?.effectDefinitions || []).flatMap(old => {
    const current = next.effectDefinitions?.find(def=>def.id===old.id);
    if (!current) return [];
    return current.revision < old.revision || (current.revision === old.revision && semantic(current)!==semantic(old))
      ? [{path:`system.effectDefinitions.${old.id}.revision`,message:'mudança de semântica exige nova revisão crescente',code:'effect.revision'}] : [];
  });
}
export function calculationTargets(pkg) {
  const targets = new Set();
  for (const layout of pkg.layouts || []) for (const tab of layout.tabs || []) for (const section of tab.sections || []) for (const container of section.containers || []) for (const component of expandComponents(container, pkg.system)) {
    if (component.type === 'computed' && component.mode !== 'roll' && component.override !== false) targets.add(`computed.${component.overrideKey || component.formula}`);
    if (component.type === 'inventorySummary' && component.override !== false) for (const stat of ['weight', 'capacity', 'excess']) targets.add(component.overrideKeys?.[stat] || `inventory.${component.overrideKey || component.field}.${stat}`);
  }
  if (pkg.system?.id === 'dnd2024') {
    for (const stat of ['proficiency','passivePerception','passiveInvestigation','passiveInsight','initiative','spellSaveDC','spellAttackBonus','totalInventoryWeight','carryCapacity','totalCurrencyValueInGp']) targets.add(`dnd.${stat}`);
    for (const ability of pkg.system.abilities || []) for (const stat of ['ability','save']) targets.add(`dnd.${stat}.${ability.key}`);
    for (const skill of pkg.system.skills || []) targets.add(`dnd.skill.${skill.key}`);
  }
  return targets;
}

export function validateEffects(value, { system, pkg, root = 'character', definitions = false } = {}) {
  if (value === undefined) return [];
  const issues = [], ids = new Set(), active = new Set(), groups = new Set();
  const at = definitions ? 'system.effectDefinitions' : `${root}.activeEffects`;
  const add = (path, message, severity) => issues.push({ path, message, code: 'effect', ...(severity ? { severity } : {}) });
  if (!Array.isArray(value) || value.length > (definitions ? EFFECT_LIMITS.definitions : EFFECT_LIMITS.instances)) { add(at, 'use uma lista de até 100 efeitos'); return issues; }
  const text = (value, path) => { if (typeof value !== 'string' || !value.trim()) add(path, 'exige texto não vazio'); };
  const duration = (entry, path) => {
    if (!object(entry)) { add(path, 'exige objeto'); return; }
    if (!['manual', 'untilEvent'].includes(entry.type)) add(`${path}.type`, 'use manual ou untilEvent');
    if (entry.type === 'untilEvent' && !EFFECT_EVENTS.includes(entry.event)) add(`${path}.event`, 'use endRound ou endScene');
    if (entry.type === 'manual' && entry.event !== undefined) add(`${path}.event`, 'manual não recebe evento');
  };
  value.forEach((entry, i) => {
    const path = `${at}[${i}]`;
    if (!object(entry)) { add(path, 'exige objeto'); return; }
    text(entry.id, `${path}.id`);
    if (ids.has(entry.id)) add(`${path}.id`, 'ID duplicado'); ids.add(entry.id);
    duration(entry.duration, `${path}.duration`);
    if (definitions) {
      text(entry.label, `${path}.label`);
      if (!Number.isSafeInteger(entry.revision) || entry.revision < 1) add(`${path}.revision`, 'exige revisão inteira positiva');
      if (entry.stacking !== 'unique') add(`${path}.stacking`, 'somente unique nesta versão');
      if (!['always', 'confirmEachRoll'].includes(entry.applicability)) add(`${path}.applicability`, 'use always ou confirmEachRoll');
      if (entry.group !== undefined) text(entry.group, `${path}.group`);
      if (!Array.isArray(entry.operations) || !entry.operations.length || entry.operations.length > EFFECT_LIMITS.operations) { add(`${path}.operations`, 'use 1–20 operações'); return; }
      const seen = new Set();
      entry.operations.forEach((op, n) => {
        const at = `${path}.operations[${n}]`, target = op?.target;
        if (!object(op) || op.type !== 'add') add(at, 'somente add');
        if (!Number.isFinite(op?.value) || Math.abs(op.value) > EFFECT_LIMITS.value) add(`${at}.value`, 'exige número finito entre −1000 e 1000');
        if (!object(target) || !['calculation', 'checkModifier'].includes(target.kind)) { add(`${at}.target`, 'use calculation ou checkModifier'); return; }
        try { pathKeys(target.key); } catch (error) { add(`${at}.target.key`, error.message); }
        if (seen.has(`${target.kind}:${target.key}`)) add(`${at}.target`, 'alvo repetido na definição'); seen.add(`${target.kind}:${target.key}`);
        if (target.kind === 'calculation') {
          if (entry.applicability !== 'always') add(`${path}.applicability`, 'cálculos exigem always');
          if (target.unit !== undefined) add(`${at}.target.unit`, 'cálculo não recebe unidade de teste');
          if (pkg && !calculationTargets(pkg).has(target.key)) add(`${at}.target.key`, 'cálculo indisponível em todos os layouts');
        } else {
          const expected = CHECK_UNITS[system?.checks?.[target.key]?.algorithm];
          if (!expected || target.unit !== expected) add(`${at}.target.unit`, 'teste inexistente ou unidade incompatível');
          if (!Number.isInteger(op.value)) add(`${at}.value`, 'modificador de teste exige inteiro');
        }
      });
    } else {
      text(entry.definitionId, `${path}.definitionId`);
      if (!Number.isSafeInteger(entry.definitionRevision) || entry.definitionRevision < 1) add(`${path}.definitionRevision`, 'exige revisão positiva');
      if (!['active','inactive','expired'].includes(entry.status)) add(`${path}.status`, 'use active, inactive ou expired');
      const definition = system?.effectDefinitions?.find(def => def.id === entry.definitionId);
      if (system && (!definition || definition.revision !== entry.definitionRevision)) add(`${path}.definitionId`, 'definição/revisão indisponível; instância preservada', entry.status === 'active' ? 'error' : 'warning');
      if (definition?.revision === entry.definitionRevision && (entry.duration?.type !== definition.duration?.type || entry.duration?.event !== definition.duration?.event)) add(`${path}.duration`, 'duração deve corresponder à definição');
      if (entry.status === 'active') {
        if (active.has(entry.definitionId)) add(path, 'efeito ativo duplicado'); active.add(entry.definitionId);
        if (definition?.group && groups.has(definition.group)) add(path, 'grupo exclusivo em conflito'); if (definition?.group) groups.add(definition.group);
      }
    }
  });
  return issues;
}
