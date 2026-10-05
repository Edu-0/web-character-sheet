// Estado declarativo; nenhuma escrita em valores-base ou relógio implícito.
import {EFFECT_EVENTS,CHECK_UNITS,EFFECT_LIMITS} from '../validation/contracts.js';
export {EFFECT_EVENTS,CHECK_UNITS} from '../validation/contracts.js';

export function effectEntries(character, system) {
  return (character.activeEffects || []).map(instance => {
    const definition = (system?.effectDefinitions || []).find(item => item.id === instance.definitionId);
    return { instance, definition, available: Boolean(definition && definition.revision === instance.definitionRevision) };
  });
}

export function effectContribution(character, system, target, { confirmed = [], enabled = true } = {}) {
  const contributions = [];
  if (enabled) for (const { instance, definition, available } of effectEntries(character, system)) {
    if (!available || instance.status !== 'active') continue;
    if (definition.applicability === 'confirmEachRoll' && !confirmed.includes(instance.id)) continue;
    for (const operation of definition.operations) {
      if (operation.target.kind !== target.kind || operation.target.key !== target.key || operation.target.unit !== target.unit) continue;
      contributions.push({ instanceId: instance.id, definitionId: definition.id, revision: definition.revision, label: definition.label, value: operation.value });
    }
  }
  const value = contributions.reduce((sum, entry) => sum + entry.value, 0);
  if (!Number.isFinite(value)) throw new Error('Soma de modificadores inválida.');
  return { value, contributions };
}

export function activateEffect(character, system, definitionId, id = globalThis.crypto.randomUUID()) {
  const definition = system.effectDefinitions?.find(item => item.id === definitionId);
  if (!definition) throw new Error('Efeito inexistente.');
  const entries = effectEntries(character, system).filter(entry => entry.instance.status === 'active');
  if (entries.some(entry => entry.instance.definitionId === definitionId)) throw new Error('Este efeito já está ativo; encerre a instância antes de reativar.');
  if (definition.group && entries.some(entry => entry.available && entry.definition.group === definition.group)) throw new Error('Há outro efeito ativo neste grupo. Desative-o explicitamente antes de ativar este.');
  if ((character.activeEffects?.length || 0) >= EFFECT_LIMITS.instances) throw new Error('Limite de 100 instâncias. Remova uma instância encerrada.');
  if (character.activeEffects?.some(entry => entry.id === id)) throw new Error('ID de instância duplicado.');
  character.schemaVersion = 2;
  character.activeEffects ??= [];
  const instance = { id, definitionId, definitionRevision: definition.revision, labelSnapshot: definition.label, status: 'active', duration: structuredClone(definition.duration) };
  character.activeEffects.push(instance);
  return instance;
}

export function changeEffectStatus(character, id, status) {
  if (!['inactive', 'expired'].includes(status)) throw new Error('Estado de efeito inválido.');
  const instance = character.activeEffects?.find(item => item.id === id);
  if (!instance) throw new Error('Instância inexistente.');
  instance.status = status;
}

export function confirmEffectEvent(character, event, ids) {
  if (!EFFECT_EVENTS.includes(event)) throw new Error('Evento não permitido.');
  for (const instance of character.activeEffects || []) if (['active','inactive'].includes(instance.status) && (!ids || ids.includes(instance.id)) && instance.duration.type === 'untilEvent' && instance.duration.event === event) instance.status = 'expired';
}

export function removeEffect(character, id) {
  const index = character.activeEffects?.findIndex(item => item.id === id) ?? -1;
  if (index < 0) throw new Error('Instância inexistente.');
  if (character.activeEffects[index].status === 'active') throw new Error('Encerre o efeito antes de removê-lo.');
  character.activeEffects.splice(index, 1);
}
