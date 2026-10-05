import { registerFieldType } from './fields.js';
import { activateEffect, changeEffectStatus, confirmEffectEvent, removeEffect, effectEntries, EFFECT_EVENTS } from './effects.js';
import { confirmDialog } from '../modal.js';
import { validateEffects } from '../validation/effects.js';

const node = (tag, text = '') => { const el = document.createElement(tag); el.textContent = text; return el; };
const statusNames = { active: 'Ativo', inactive: 'Inativo', expired: 'Expirado' };
export function effectDescription(entry, character) {
  const { definition, instance, available } = entry;
  if (!available) return `${instance.definitionId}: definição/revisão indisponível · ${statusNames[instance.status]}`;
  const operations = definition.operations.map(op => `${op.target.key}: ${op.value >= 0 ? '+' : ''}${op.value}${op.target.unit ? ` (${op.target.unit})` : ''}${op.target.kind === 'calculation' && character.calculationOverrides?.[op.target.key]?.mode === 'fixed' ? ' · suprimido pelo valor fixo' : ''}`);
  return `${definition.label} · ${statusNames[instance.status]} · ${operations.join('; ')} · ${instance.duration.type === 'manual' ? 'encerramento manual' : instance.duration.event === 'endRound' ? 'até fim de rodada confirmado' : 'até fim de cena confirmado'}${definition.applicability === 'confirmEachRoll' ? ' · confirmar em cada teste' : ''}`;
}

registerFieldType('effectList', {
  search: ({character, system, label}) => effectEntries(character,system).map(entry => ({label, value:effectDescription(entry,character)})),
  print: ({character, system, label}) => {
    const wrap = node('div'); wrap.className = 'engine-effects'; wrap.append(node('h3', label || 'Efeitos'));
    for (const entry of effectEntries(character, system)) wrap.append(node('p', effectDescription(entry,character)));
    if (!character.activeEffects?.length) wrap.append(node('p', 'Nenhum efeito registrado.'));
    return wrap;
  },
  render(container, {character, system, label, onChange, registerRefresh, upgradeCharacter}) {
    const mutate = operation => {
      const draft = structuredClone(character); operation(draft);
      const error = validateEffects(draft.activeEffects,{system}).find(issue=>issue.severity !== 'warning');
      if (error) throw new Error(`${error.path}: ${error.message}`);
      if (draft.activeEffects !== undefined) character.activeEffects = draft.activeEffects;
      character.schemaVersion = draft.schemaVersion;
    };
    const wrap = node('div'); wrap.className = 'engine-effects';
    wrap.append(node('h3', label || 'Efeitos'));
    const definitions = node('div'), instances = node('div'), events = node('div');
    const status = node('p'); status.setAttribute('role','status');
    const action = (host, title, operation) => {
      const button = node('button', title); button.type = 'button'; button.className = 'button button--ghost';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { if (await operation() !== false) { onChange?.(); refresh(); status.textContent = ''; } }
        catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
      }); host.append(button); return button;
    };
    for (const definition of system.effectDefinitions || []) action(definitions, `Ativar ${definition.label}`, async () => {
      if (character.schemaVersion === 1) {
        if (!await confirmDialog('A ativação usará a versão 2 do personagem. Uma cópia do original será preservada. O histórico de edições será reiniciado antes da ativação.', {title:'Ativar efeitos', confirmLabel:'Migrar e ativar'})) return false;
        if (!upgradeCharacter) throw new Error('Migração indisponível nesta apresentação.');
        await upgradeCharacter(character);
      }
      mutate(draft=>activateEffect(draft,system,definition.id));
    });
    for (const event of EFFECT_EVENTS) action(events, event === 'endRound' ? 'Confirmar fim de rodada' : 'Confirmar fim de cena', async () => {
      const affected = structuredClone((character.activeEffects || []).filter(instance=>['active','inactive'].includes(instance.status) && instance.duration.type==='untilEvent' && instance.duration.event===event));
      if (!await confirmDialog(`A mesa confirmou este evento? Efeitos a expirar: ${affected.map(instance=>instance.labelSnapshot || instance.definitionId).join(', ') || 'nenhum'}.`, {title:event === 'endRound' ? 'Fim de rodada' : 'Fim de cena',confirmLabel:'Confirmar evento'})) return false;
      if (affected.some(instance=>JSON.stringify(character.activeEffects?.find(current=>current.id===instance.id))!==JSON.stringify(instance))) throw new Error('Efeitos mudaram durante a confirmação; revise o evento.');
      mutate(draft=>confirmEffectEvent(draft,event,affected.map(instance=>instance.id)));
    });
    const refresh = () => {
      instances.replaceChildren();
      for (const entry of effectEntries(character,system)) {
        const row = node('div'); row.className = 'engine-effects__entry'; row.append(node('p',effectDescription(entry,character)));
        if (entry.instance.status === 'active') {
          action(row, `Desativar ${entry.definition?.label || entry.instance.definitionId}`, () => mutate(draft=>changeEffectStatus(draft,entry.instance.id,'inactive')));
          action(row, `Expirar ${entry.definition?.label || entry.instance.definitionId}`, () => mutate(draft=>changeEffectStatus(draft,entry.instance.id,'expired')));
        } else action(row, `Remover ${entry.definition?.label || entry.instance.definitionId}`, () => mutate(draft=>removeEffect(draft,entry.instance.id)));
        instances.append(row);
      }
    };
    wrap.append(definitions,instances,events,status);container.append(wrap);registerRefresh?.(refresh);refresh();
  },
});
