import {prepareActionIntent} from './action-plan.js';
import {openModal,confirmDialog} from '../modal.js';
import {compileTriggers,prepareManualEvent,prepareNamedEvent,prepareEventStateChange} from './rule-events.js';
import {dataDefinitions,readData} from './data-definitions.js';
import {mountRecordInputs} from './typed-record-inputs.js';
import {formatTypedCell} from './typed-value-format.js';
const node=(tag,text='')=>{const el=document.createElement(tag);el.textContent=text;return el;};
const focusEvents=()=>[...document.querySelectorAll('.engine-actions button')].find(b=>b.textContent==='Eventos e gatilhos')?.focus();
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.className='button';el.addEventListener('click',fn);return el;};
const select=(label,rows)=>{const wrap=node('label',label),control=node('select');control.setAttribute('aria-label',label);for(const [id,text]of rows){const option=node('option',text);option.value=id;control.append(option);}wrap.append(control);return {wrap,control};};

export function openRuleEvents(context,{openAction}={}){
 const {system}=context,character=()=>context.getCharacter?.()||context.character,compiled=compileTriggers(system),body=node('section');body.className='engine-action-flow';
 const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');let busy=false,plan,closed=false,close;
 const mount=()=>{close=openModal({title:'Eventos e gatilhos locais',contentEl:body,actions:[{label:'Fechar',onClick:()=>{closed=true;focusEvents();}}],onClose:()=>{closed=true;focusEvents();}});};
 const run=async fn=>{if(busy)return;busy=true;try{await fn();}catch(error){status.textContent=error.message;if(!body.isConnected&&!closed)mount();}finally{busy=false;}};
 const commit=(prepared,label,recovery=false)=>context.commitPreparedMutation(prepared,{label,recovery});
 const preview=node('section'),controls=node('div');body.append(node('p','Edições comuns não disparam gatilhos. Este painel prepara uma edição ou evento explícito e mostra toda a cadeia antes de confirmar. Abrir, importar, recarregar e desfazer/refazer nunca geram novos eventos.'));
 const clear=()=>{plan=undefined;preview.replaceChildren();controls.replaceChildren();};
 const show=prepared=>{
  clear();plan=prepared;
  for(const change of plan.patches){const path=change.path.join('.'),row=dataDefinitions(system).find(r=>[...r.ancestors.map(d=>d.binding),r.definition.binding].join('.')===path);if(!row)continue;
   const format=(present,value)=>formatTypedCell(system,character(),row.definition,present?{present:true,value}:{present:false});preview.append(node('p',row.definition.label+': '+format(change.beforeExists,change.before)+' → '+format(change.afterExists,change.after)));}
  for(const cause of plan.causal||[])preview.append(node('p',cause.label+' · origem '+cause.origin+(cause.before!==undefined?' · '+cause.before+' → '+cause.after:'')+(cause.limits.length?' · limites '+cause.limits.join(', '):'')+' · '+(cause.mode==='propose'?'guardar proposta':'incluir consequência')));
  for(const effect of plan.effectChanges||[])preview.append(node('p',effect.label+': eventos '+effect.before+' → '+effect.after));
  controls.append(button('Confirmar cadeia',()=>run(async()=>{await commit(plan,'Confirmar cadeia de eventos');closed=true;close();focusEvents();})),button('Cancelar cadeia',clear));status.textContent='Prévia causal pronta. Nenhum valor ou marcador foi gravado.';
 };
 if(character().schemaVersion!==3){body.append(node('p','Eventos exigem habilitação explícita de registros v3, preservando o original.'),button('Habilitar eventos v3',()=>run(async()=>{if(await confirmDialog('Habilitar personagem v3 e preservar original em recuperação?',{title:'Habilitar eventos',confirmLabel:'Habilitar v3'})){await context.upgradeActionCharacter();closed=true;close();focusEvents();}})));}
 else{
  const manual=compiled.filter(r=>r.trigger.enabled&&r.trigger.origins.includes('manual')&&r.trigger.dataId),ids=[...new Set(manual.map(r=>r.trigger.dataId))];
  if(ids.length){const rows=ids.map(id=>[id,dataDefinitions(system).find(r=>r.definition.id===id).definition.label]),choice=select('Dado para editar com gatilhos',rows),inputs=node('div');let read;
   const draw=()=>{clear();inputs.replaceChildren();const row=dataDefinitions(system).find(r=>r.definition.id===choice.control.value),definition={...row.definition,binding:row.definition.id},cell=readData(system,character(),definition.id);delete definition.initial;read=mountRecordInputs(inputs,{definition:{fields:[definition]},system,character:character(),label:'Edição com gatilhos',base:cell.present?{[definition.id]:cell.value}:{},onEdit:clear});};
   choice.control.addEventListener('change',draw);body.append(node('h3','Edição explícita'),choice.wrap,inputs,button('Revisar edição e gatilhos',()=>run(()=>{const values=read(),id=choice.control.value;show(prepareManualEvent(system,character(),id,Object.hasOwn(values,id)?{present:true,value:values[id]}:{present:false}));})));draw();
  }
  const named=[...new Set([...compiled.filter(r=>r.trigger.enabled&&r.trigger.eventName).map(r=>r.trigger.eventName),...(system.effectDefinitions||[]).filter(d=>d.profile==='typed'&&d.duration.type==='untilEvent').map(d=>d.duration.eventName)])];
  if(named.length){const choice=select('Evento a confirmar',named.map(id=>[id,[...compiled.filter(r=>r.trigger.eventName===id).map(r=>r.trigger.label),...(system.effectDefinitions||[]).filter(d=>d.profile==='typed'&&d.duration.eventName===id).map(d=>d.label)].join(' / ')])),reset=node('input');reset.type='checkbox';const label=node('label','Iniciar nova cena nesta confirmação');label.prepend(reset);reset.addEventListener('change',clear);choice.control.addEventListener('change',clear);body.append(node('h3','Evento de jogo'),choice.wrap,label,button('Revisar evento explícito',()=>run(()=>show(prepareNamedEvent(system,character(),choice.control.value,{resetScene:reset.checked})))));}
  body.append(node('h3','Propostas guardadas'));
  for(const proposal of character().ruleEventState?.proposals||[]){const section=node('section');section.append(node('h4',proposal.label),node('p','Origem '+proposal.origin+(proposal.before!==undefined?' · '+proposal.before+' → '+proposal.after:'')+(proposal.limits.length?' · limites '+proposal.limits.join(', '):'')));const action=system.sheetActions?.find(a=>a.id===proposal.actionId);
   if(action&&openAction){let unavailable;if(action.flow.steps.some(step=>step.type==='acquire')&&!action.flow.steps.some(step=>step.type==='resolve')&&!action.flow.inputs?.length)try{prepareActionIntent(system,character(),action,{inputs:proposal.inputs||{}});}catch(error){unavailable=error.message;}const review=button('Revisar proposta '+proposal.label,()=>{closed=true;close();focusEvents();openAction({...context,proposalId:proposal.id,actionInputs:proposal.inputs||{}},action);});review.disabled=Boolean(unavailable);if(unavailable)section.append(node('p','Proposta indisponível: '+unavailable));section.append(review);}else section.append(node('p','Ação da proposta indisponível neste sistema. Exporte antes de dispensar.'));
   section.append(button('Dispensar proposta '+proposal.label,()=>run(async()=>{if(!await confirmDialog('Dispensar esta proposta sem executar nem cobrar? O marcador de frequência permanece.',{title:'Dispensar proposta',confirmLabel:'Dispensar'}))return;await commit(prepareEventStateChange(system,character(),{dismissId:proposal.id}),'Dispensar proposta');closed=true;close();focusEvents();})));body.append(section);
  }
  if(context.exportActionCharacter)body.append(button('Exportar personagem com eventos',()=>context.exportActionCharacter()));
  body.append(node('h3','Eventos registrados'),node('p',(character().ruleEventState?.events?.length||0)+' de100 eventos, até256KiB no conjunto. As identidades, mudanças e propostas são guardadas na mesma transação.'));
  const value=(present,data)=>present?data===null?'Nulo':typeof data==='object'?JSON.stringify(data):String(data):'Ausente';
  for(const event of character().ruleEventState?.events||[]){const box=node('details');box.append(node('summary',({action:'Resultado de ação',manual:'Edição explícita',event:'Evento de jogo'})[event.origin]+' · '+new Date(event.createdAt).toLocaleString('pt-BR')));for(const change of event.changes)box.append(node('p',change.label+': '+value(change.beforeExists,change.before)+' → '+value(change.afterExists,change.after)));for(const cause of event.causal)box.append(node('p',cause.label+' · '+(cause.mode==='propose'?'proposta':'consequência')+(cause.limits.length?' · limites '+cause.limits.join(', '):'')));body.append(box);}
  if(character().ruleEventState?.roots.length)body.append(button('Arquivar identidades de eventos concluídos',()=>run(async()=>{if(!await confirmDialog('Arquivar as identidades de transações já concluídas? Uma cópia do personagem será preservada em recuperação. Frequências e propostas permanecem.',{title:'Arquivar eventos',confirmLabel:'Arquivar'}))return;await commit(prepareEventStateChange(system,character(),{archiveRoots:true}),'Arquivar eventos concluídos',true);closed=true;close();focusEvents();})));
 }
 body.append(preview,status,controls);mount();
 return {isClosed:()=>closed};
}
