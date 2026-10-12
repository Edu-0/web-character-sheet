import {openModal,confirmDialog} from '../modal.js';
import {mountRecordInputs} from './typed-record-inputs.js';
import {prepareActionIntent,resolveActionIntent,prepareActivationMilestone,resumeActionIntent,prepareTranscriptMilestone,prepareCompletionMilestone} from './action-plan.js';
import {actionSignature} from './action-records.js';
import {compareRollValue} from './roll-transcript.js';
import {formatTypedCell} from './typed-value-format.js';
import {dataDefinitions} from './data-definitions.js';
import {prepareEventChain,completeEventProposal,bindEventProposal} from './rule-events.js';

const node=(tag,text='')=>{const el=document.createElement(tag);el.textContent=text;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.className='button';el.addEventListener('click',fn);return el;};
// Failed writes keep the prepared transcript for a retry in this page. This is
// a disposable plan, never a replacement for the character or its saved marker.
const retries=new Map();
const focusAction=label=>[...document.querySelectorAll('.engine-actions button')].find(button=>button.textContent===label)?.focus();

export async function openTypedAction(context,action){
 const {system}=context,character=()=>context.getCharacter?.()||context.character;
 if(!context.commitPreparedAction)throw Error('Gravação preparada indisponível nesta apresentação.');
 const signature=await actionSignature(system,action),body=node('section');body.className='engine-action-flow';
 const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const explanation=node('p',action.flow.profile==='activation'?'A confirmação de ativação paga os custos declarados antes de revelar dados. Fechar depois disso conserva a ativação para retomar.':'Resolver mostra uma prévia. Recursos e consequências mudam somente na confirmação. Cancelar a prévia conserva a ficha.');
 const inputs=node('div'),report=node('div'),controls=node('div');controls.className='engine-budget__actions';body.append(explanation,inputs,report,status,controls);
 let busy=false,intent,plan,completedPlan,record=character().actionRecords?.find(r=>r.actionId===action.id&&r.phase!=='complete'&&(!context.proposalId||r.extensions?.proposal?.id===context.proposalId)),choices={},readInputs,closed=false;
 if(record){intent=resumeActionIntent(system,character(),action,record,signature);const retry=retries.get(record.id);if(retry?.signature===signature)intent=retry.intent;}
 const commit=async prepared=>{await context.commitPreparedAction(action,prepared,{historyField:context.historyField||'scene.lastAction'});record=character().actionRecords?.find(r=>r.id===prepared.id);};
 const run=async fn=>{if(busy)return;busy=true;drawControls();try{await fn();}catch(error){status.textContent=error.message;}finally{busy=false;if(!closed)drawControls();}};
 const saveResolution=async(error)=>{
  if(!record)return;
  retries.set(intent.id,{signature,intent:structuredClone(intent)});
  await commit(prepareTranscriptMilestone(system,character(),action,record,intent,signature,{...(error?{error}:plan?{results:plan.results}:{})}));
  retries.delete(intent.id);
 };
 const resolve=async()=>{
  report.replaceChildren();completedPlan=undefined;
  if(record)intent={...resumeActionIntent(system,character(),action,record,signature),transcripts:structuredClone(intent.transcripts)};
  else intent??=prepareActionIntent(system,character(),action,{inputs:readInputs()});
  try{plan=resolveActionIntent(system,character(),action,intent,{choices,...(record?{activation:record,signature}:{})});intent=plan.intent;}
  catch(error){if(error.actionIntent)intent=error.actionIntent;plan=undefined;await saveResolution(error.message);throw error;}
  await saveResolution();
  if(record){intent=resumeActionIntent(system,character(),action,record,signature);plan=resolveActionIntent(system,character(),action,intent,{activation:record,signature,die:()=>{throw Error('Transcript incompleto; retome a resolução.');}});intent=plan.intent;}
  completedPlan=completeEventProposal(system,character(),prepareEventChain(system,character(),prepareCompletionMilestone(system,character(),action,plan,signature,{...(record?{activation:record}:{})})),context.proposalId||record?.extensions?.proposal?.id,action.id);
  showResult();status.textContent='Resultado preparado. Revise os custos e confirme a aplicação.';
 };
 const showResult=()=>{
  report.replaceChildren();if(!plan)return;
  for(const result of plan.results){const section=node('section');section.append(node('h3',result.label),node('p','Total: '+result.total+(result.success===undefined?'':result.success?' · sucesso':' · falha')+(result.outcome?' · '+result.outcome:'')));report.append(section);
   for(const group of result.groups||[]){section.append(node('h4',group.label),node('p',group.type==='sharedPercentile'?'Unidade '+group.units+' · candidatos '+group.candidates.join(', '):group.dice.map(d=>'d'+d.sides+': '+d.original+(d.rerolls.length?' → '+d.rerolls.join(' → '):'')+(d.explosions.length?' + '+d.explosions.join(' + '):'')+(d.kept?'':' (descartado)')).join('; ')));
    const config=plan.transcripts[result.id]?.configuration.groups.find(g=>g.id===group.id);
    if(config?.reroll?.optional && !plan.transcripts[result.id].choices[group.id]){choices[result.id]??={};const selected=choices[result.id][group.id]??=[];
     for(const die of group.dice.filter(d=>compareRollValue(d.original,config.reroll.when))){const label=node('label','Rerrolar dado '+(die.index+1)+' de '+group.label),check=node('input');check.type='checkbox';check.checked=selected.includes(die.index);check.addEventListener('change',()=>{choices[result.id][group.id]=[...section.querySelectorAll('input[data-group="'+group.id+'"]:checked')].map(el=>Number(el.value));});check.dataset.group=group.id;check.value=String(die.index);label.prepend(check);section.append(label);}
     section.append(node('p','Escolha até '+config.reroll.limit+' dados; política '+(config.reroll.mode==='replace'?'substituir':'somar')+'.'),button('Aplicar rerrolagem em '+group.label,()=>run(resolve)));
    }
   }
  }
  for(const payment of plan.payments)report.append(node('p',payment.label+': '+payment.before+' → '+payment.after+' (custo '+payment.amount+').'));
  for(const cause of completedPlan?.causal||[]){report.append(node('h3',cause.label),node('p','Origem: '+cause.origin+(cause.before!==undefined?' · '+cause.before+' → '+cause.after:'')+(cause.limits.length?' · limites '+cause.limits.join(', '):'')+' · '+(cause.mode==='propose'?'Proposta guardada; executar exige nova confirmação.':'Consequência incluída nesta confirmação.')));for(const payment of cause.payments||[])report.append(node('p',payment.label+': '+payment.before+' → '+payment.after+' (custo '+payment.amount+').'));}
  for(const change of plan.changes||[]){const row=dataDefinitions(system).find(r=>r.ancestors.map(d=>d.binding).concat(r.definition.binding).join('.')===change.field);if(!row||plan.payments.some(p=>p.dataId===row.definition.id))continue;const format=(exists,value)=>formatTypedCell(system,character(),row.definition,exists?{present:true,value}:{present:false},plan.dataContext);report.append(node('p',row.definition.label+': '+format(change.beforeExists,change.before)+' → '+format(change.afterExists,change.after)));}
 };
 const drawControls=()=>{
  controls.replaceChildren();
  if(character().schemaVersion!==3){controls.append(button('Habilitar registros recuperáveis v3',()=>run(async()=>{
   if(!await confirmDialog('Habilitar registros de ações neste personagem? A ficha original será preservada em recuperação. Não altera os valores atuais.',{title:'Habilitar personagem v3',confirmLabel:'Habilitar v3'}))return;
   await context.upgradeActionCharacter();closed=true;
  })));return;}
  if(!record && action.flow.profile==='activation')controls.append(button('Comprometer ativação',()=>run(async()=>{
   intent??=prepareActionIntent(system,character(),action,{inputs:readInputs()});const prepared=bindEventProposal(system,character(),prepareActivationMilestone(system,character(),action,intent,signature),context.proposalId,action.id);await commit(prepared);intent=resumeActionIntent(system,character(),action,record,signature);inputs.replaceChildren();status.textContent='Ativação guardada. Os custos de ativação já foram pagos; retomar não paga novamente.';
  })));
  else controls.append(button(record?'Resolver ou retomar execução':'Resolver prévia',()=>run(resolve)));
  if(plan && completedPlan && !retries.has(plan.id))controls.append(button('Confirmar resultado',()=>run(async()=>{
   await commit(completedPlan);retries.delete(completedPlan.id);status.textContent='Resultado aplicado e registrado.';closed=true;close();focusAction(action.label);
  })));
  if(record && retries.has(record.id))controls.append(button('Guardar transcript e retomar',()=>run(async()=>{await saveResolution();await resolve();})));
  if(busy)for(const control of controls.querySelectorAll('button'))control.disabled=true;
 };
 if(!record)readInputs=mountRecordInputs(inputs,{definition:{fields:action.flow.inputs||[]},system,character:character(),label:action.label,state:{},base:context.actionInputs||{},onEdit:()=>{if(intent&&!record){intent=undefined;plan=undefined;report.replaceChildren();drawControls();}}});
 else status.textContent='Execução pendente encontrada. Retomar usa as faces já guardadas.';
 drawControls();
 const close=openModal({title:action.label,contentEl:body,onClose:()=>{closed=true;focusAction(action.label);},actions:[{label:action.flow.profile==='activation'?'Fechar e retomar depois':'Cancelar prévia',className:'button button--ghost',onClick:()=>{closed=true;focusAction(action.label);}}]});
 return close;
}

export function openActionRecords(context){
 const character=()=>context.getCharacter?.()||context.character,body=node('section');body.className='engine-action-flow';
 const status=node('p');status.setAttribute('role','status');const records=character().actionRecords||[],selected=[];
 body.append(node('p',records.length+' de 50 registros. Até 64 KiB por execução e 512 KiB no conjunto. Pendentes são conservados para retomada; somente concluídos podem ser arquivados.'),node('p',context.preview?'Ensaio isolado: os registros não entram no pacote exportado.':'Exporte o personagem para levar seus registros. Arquivar preserva uma cópia completa em recuperação e pode ser desfeito nesta sessão.'));
 for(const record of records){const action=context.system.sheetActions?.find(a=>a.id===record.actionId),box=node('details');box.append(node('summary',(action?.label||record.actionId)+' · '+({activated:'ativada',resolved:'resultado guardado',complete:'concluída'})[record.phase]+' · '+new Date(record.createdAt).toLocaleString('pt-BR')));body.append(box);
  for(const definition of action?.flow?.inputs||[]){let value;try{value=formatTypedCell(context.system,character(),definition,Object.hasOwn(record.inputs,definition.id)?{present:true,value:record.inputs[definition.id]}:{present:false},record.dataContext);}catch{value='Fonte atual indisponível; valor original conservado no registro.';}box.append(node('p',definition.label+': '+value));}
  for(const result of record.results||[])box.append(node('p',result.label+': '+result.total+(result.success===undefined?'':result.success?' · sucesso':' · falha')));
  for(const transcript of Object.values(record.transcripts))box.append(node('p','Faces guardadas: '+transcript.draws.map(draw=>'d'+draw.sides+'='+draw.value).join(', ')));
  for(const payment of record.payments)box.append(node('p',(payment.label||'Recurso')+': '+payment.before+' → '+payment.after));
  if(record.error)box.append(node('p',record.error));
  if(record.phase==='complete'){const label=node('label','Arquivar '+(action?.label||record.actionId)),check=node('input');check.type='checkbox';label.prepend(check);body.append(label);selected.push({record,check});}
 }
 if(context.exportActionCharacter)body.append(button('Exportar personagem com registros',()=>context.exportActionCharacter()));
 const archive=button('Arquivar concluídos selecionados',async()=>{archive.disabled=true;try{const ids=selected.filter(row=>row.check.checked).map(row=>row.record.id);if(!ids.length)throw Error('Selecione ao menos um registro concluído.');if(!await confirmDialog('Arquivar '+ids.length+' registros concluídos? '+(context.preview?'Ensaio isolado.':'Uma cópia completa do personagem será preservada em recuperação.'),{title:'Arquivar registros',confirmLabel:'Confirmar arquivamento'}))return;if(!context.archiveActionRecords)throw Error('Arquivamento indisponível.');await context.archiveActionRecords(ids);close();focusAction('Registros de ações');}catch(error){status.textContent=error.message;openModal({title:'Registros de ações',contentEl:body});}finally{archive.disabled=false;}});
 body.append(archive,status);const close=openModal({title:'Registros de ações',contentEl:body});return close;
}
