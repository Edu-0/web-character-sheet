import {openModal,confirmDialog} from '../modal.js';
import {prepareTypedEffectChange} from './typed-effect-state.js';
import {typedEffectDefinition,typedEffectTarget} from './typed-effect-contract.js';
import {projectTypedTarget} from './typed-effect-runtime.js';
import {applyCharacterChanges} from './character-history.js';
import {readData} from './data-definitions.js';
import {evaluateRule} from './rule-registry.js';
import {formatTypedCell} from './typed-value-format.js';
import {openRuleEvents} from './event-fields.js';
const node=(tag,text='')=>{const el=document.createElement(tag);el.textContent=text;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.className='button button--ghost';el.addEventListener('click',fn);return el;};
const focusDefinition=id=>document.querySelector('.engine-effects button[data-effect-definition="'+id+'"]')?.focus();
export function typedEffectDescription(entry,system){
 const {definition,instance,available}=entry,label=definition?.label||instance.labelSnapshot||'Efeito';if(!available)return label+': revisão indisponível; instância preservada.';
 const duration=instance.duration.type==='manual'?'encerramento manual':instance.duration.type==='uses'?instance.duration.remaining+' uso(s) restante(s)':instance.duration.remaining+' evento(s) restante(s)';
 return label+' · '+({active:'Ativo',inactive:'Inativo',expired:'Expirado'})[instance.status]+' · '+duration+' · '+definition.operations.map(op=>({replace:'Substituir',multiply:'Multiplicar',add:'Somar',clamp:'Limitar',shiftTrait:'Alterar passos'})[op.type]+' em '+typedEffectTarget(system,op.target).label).join('; ');
}
function reviewEffect(context,plan,label,definitionId){
 const character=()=>context.getCharacter?.()||context.character,{system}=context,body=node('section');body.className='engine-action-flow';const candidate=structuredClone(character());applyCharacterChanges(candidate,plan.patches,{validate:context.validateCharacter});
 body.append(node('p','A prévia projeta o valor atual. A base permanece editável e é preservada. Ativar/encerrar não cobra nenhum custo que não tenha sido declarado em uma ação.'));
 const definition=system.effectDefinitions.find(d=>d.id===definitionId),seen=new Set();let projectionError='';for(const operation of definition?.operations||[]){const key=JSON.stringify(operation.target);if(seen.has(key))continue;seen.add(key);const target=typedEffectTarget(system,operation.target),base=char=>operation.target.kind==='data'?readData(system,char,operation.target.dataId):{present:true,value:evaluateRule(system,char,operation.target.ruleId)};
  const format=(char,cell)=>formatTypedCell(system,char,target,cell);let before;try{before=format(character(),projectTypedTarget(system,character(),operation.target,base(character())).cell);}catch(error){before='Projeção atual indisponível: '+error.message;}try{const after=projectTypedTarget(system,candidate,operation.target,base(candidate)).cell;body.append(node('p',target.label+': '+before+' → '+format(candidate,after)));}catch(error){projectionError=error.message;body.append(node('p','Projeção preparada inválida: '+error.message));}
 }
 const status=node('p');status.setAttribute('role','status');body.append(status);let busy=false;
 const close=openModal({title:label,contentEl:body,actions:[{label:'Confirmar efeito',closeOnClick:false,onClick:async()=>{if(busy)return;busy=true;try{if(projectionError)throw Error(projectionError);if(!context.commitPreparedMutation)throw Error('Gravação preparada indisponível.');await context.commitPreparedMutation(plan,{label});close();focusDefinition(definitionId);}catch(error){status.textContent=error.message;}finally{busy=false;}}},{label:'Cancelar prévia de efeito',onClick:()=>focusDefinition(definitionId)}],onClose:()=>focusDefinition(definitionId)});return close;
}
export function renderTypedEffectControls(host,context){
 const character=()=>context.getCharacter?.()||context.character,{system}=context,status=node('p');status.setAttribute('role','status');host.append(status);
 const run=fn=>{try{fn();}catch(error){status.textContent=error.message;}};
 if(character().schemaVersion!==3){const upgrade=button('Habilitar efeitos tipados v3',async()=>{try{if(!await confirmDialog('Habilitar personagem v3, preservando o original em recuperação?',{title:'Habilitar efeitos tipados',confirmLabel:'Habilitar v3'}))return;await context.upgradeActionCharacter();}catch(error){status.textContent=error.message;}});host.append(upgrade);return;}
 for(const definition of (system.effectDefinitions||[]).filter(typedEffectDefinition)){const control=button('Ativar '+definition.label,()=>run(()=>reviewEffect(context,prepareTypedEffectChange(system,character(),{type:'activate',definitionId:definition.id}),'Ativar '+definition.label,definition.id)));control.dataset.effectDefinition=definition.id;host.append(control);}
 if((system.effectDefinitions||[]).some(d=>d.profile==='typed'&&d.duration.type==='untilEvent'))host.append(button('Eventos de efeitos',()=>run(()=>openRuleEvents(context))));
 const instances=node('div');host.append(instances);const refresh=()=>{instances.replaceChildren();for(const instance of character().activeEffects||[]){if(instance.profile!=='typed')continue;const definition=system.effectDefinitions.find(d=>d.id===instance.definitionId),row=node('div'),entry={instance,definition,available:Boolean(definition&&definition.revision===instance.definitionRevision)};row.append(node('p',typedEffectDescription(entry,system)));const label=definition?.label||instance.labelSnapshot||'Efeito';row.append(button(instance.status==='active'?'Encerrar '+label:'Remover '+label,()=>run(()=>reviewEffect(context,prepareTypedEffectChange(system,character(),{type:instance.status==='active'?'end':'remove',instanceId:instance.id}),instance.status==='active'?'Encerrar '+label:'Remover '+label,instance.definitionId))));instances.append(row);}};
 refresh();context.registerRefresh?.(refresh);
}
