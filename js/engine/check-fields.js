import { registerFieldType } from './fields.js';
import { getByPath } from './paths.js';
import { checkSources, prepareCheck, collectionCheckSourceId } from './checks.js';
import { effectEntries, effectContribution, CHECK_UNITS } from './effects.js';
import { recordCheck } from '../dice.js';
import {openModal} from '../modal.js';

function el(tag, text = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

export function renderCheck(container, { character, system, configFrom, label, registerRefresh, presetSourceId }) {
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
    const contextual = el('div'), effectStatus = el('p'); effectStatus.className = 'engine-note';
    const checkId = configFrom.slice('checks.'.length);
    function refresh() {
      const previous = source.value || presetSourceId;
      try {
        source.replaceChildren(...checkSources(config, character, system).map(item => {
          const option = el('option', `${item.label} (${item.error ? 'indisponível' : item.value ?? '—'})`); option.value = item.id; return option;
        }));
        if ([...source.options].some(option => option.value === previous)) source.value = previous;
        else if (presetSourceId) { const unavailable=el('option','Fonte referenciada indisponível; selecione outra conscientemente');unavailable.value='';source.prepend(unavailable);source.value=''; }
      } catch (error) {
        source.replaceChildren(el('option', `Fonte indisponível: ${error.message}`));
      }
      contextual.replaceChildren();
      for (const entry of effectEntries(character,system).filter(entry => entry.available && entry.instance.status === 'active' && entry.definition.applicability === 'confirmEachRoll' && entry.definition.operations.some(op => op.target.kind === 'checkModifier' && op.target.key === checkId))) {
        const field = el('label'), input = el('input'); input.type = 'checkbox'; input.value = entry.instance.id;
        field.append(input, el('span',`Aplicar ${entry.definition.label} neste teste`)); contextual.append(field);
      }
      const contribution = effectContribution(character,system,{kind:'checkModifier',key:checkId,unit:CHECK_UNITS[config.algorithm]});
      effectStatus.textContent = contribution.contributions.length ? `Efeitos ativos: ${contribution.contributions.map(entry => `${entry.label} ${entry.value >= 0 ? '+' : ''}${entry.value}`).join('; ')}. O modificador informado é adicional.` : '';
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
        if ((modifier && !modifier.value) || (target && !target.value)) throw new Error('Preencha os valores do teste.');
        const prepared = prepareCheck({config,character,system,checkId,sourceId:source.value,confirmed:[...contextual.querySelectorAll('input:checked')].map(input=>input.value),
          options:{modifier:Number(modifier?.value ?? 0),target:Number(target?.value ?? 0),wild:wild?.checked,untrained:untrained?.checked}});
        const result = prepared.execute();
        output.textContent = `${prepared.source.label}: ${result.total} · ${result.outcome}. ${result.detail}`;
        const entry = recordCheck({ ...result, label: `${label} · ${prepared.source.label}` });
        contextual.querySelectorAll('input').forEach(input=>{input.checked=false;});
        document.dispatchEvent(new CustomEvent('sheet:rolled', { detail: entry }));
      } catch (error) { output.textContent = error.message; }
    });
    wrap.append(controls,contextual,effectStatus, button, output, hint); container.append(wrap);
}

registerFieldType('checkRoll',{print:()=>null,search:({label})=>[{label,value:'Teste sob demanda; decisões e custos manuais'}],render:renderCheck});

export function createCheckButton(context) {
  const button=el('button',`Rolar ${context.label || 'teste'}`);button.type='button';button.className='button button--ghost engine-field-roll';
  if (context.type==='list' && !context.itemId) {button.disabled=true;button.title='Entrada legada sem identidade estável; teste disponível no painel de fontes.';button.dataset.intrinsicDisabled='true';}
  button.addEventListener('click',()=>{
    try {
    const content=el('div'), roll=context.roll;
    const source=getByPath(context.system,`checks.${roll.check}`).sources.find(source=>source.id===roll.sourceId);
    if (!source || source.collection && !context.itemId) throw new Error('Fonte sem identidade estável ou indisponível.');
    const presetSourceId=source.collection ? collectionCheckSourceId(roll.sourceId,context.itemId) : roll.sourceId;
    renderCheck(content,{...context,configFrom:`checks.${roll.check}`,presetSourceId,registerRefresh:undefined});
    let dialog;
    const trap=event=>{
      if(event.key!=='Tab') return;
      const controls=[...dialog.querySelectorAll('button,input,select')].filter(control=>!control.disabled&&control.getClientRects().length);
      if(event.shiftKey&&document.activeElement===controls[0]) {event.preventDefault();controls.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}
    };
    const cleanup=()=>dialog.removeEventListener('keydown',trap);
    openModal({title:`Rolar ${context.label || 'teste'}`,contentEl:content,actions:[{label:'Fechar',onClick:cleanup}],onClose:cleanup});
    dialog=content.closest('.modal');dialog.addEventListener('keydown',trap);
    } catch(error) {openModal({title:'Teste indisponível',contentEl:el('p',error.message),actions:[{label:'Fechar'}]});}
  });
  return button;
}
