import {registerFieldType} from './fields.js';
import {openModal,confirmDialog} from '../modal.js';
import {prepareProgressionChoice,prepareProgressionPhase,prepareProgressionRevocation} from './progression-choices.js';
import {applyCharacterChanges} from './character-history.js';
import {readData,dataDefinition} from './data-definitions.js';

const node=(tag,text='',className='')=>{const element=document.createElement(tag);element.textContent=text;element.className=className;return element;};
const button=(label,fn,key)=>{const element=node('button',label,'button button--ghost');element.type='button';if(key)element.dataset.progressionCommand=key;element.addEventListener('click',fn);return element;};
const modes={creation:'Criação',paid:'Evolução paga',narrative:'Concessão narrativa'};
function description(record){return record.label+' · '+modes[record.mode]+' · custo registrado '+record.cost.amount+' · '+(record.status==='active'?'Ativa':'Revogada');}

function review(context,plan,label,returnFocus){
 const content=node('section','','engine-action-flow'),candidate=structuredClone(context.getCharacter?.()||context.character);applyCharacterChanges(candidate,plan.patches,{validate:context.validateCharacter});
 content.append(node('p','A prévia reúne orçamento, escolhas e concessões. Cancelar preserva a ficha. Alterações diretas durante jogo não registram compra.'),...plan.details.map(detail=>node('p',detail)));
 const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');content.append(status);let busy=false;
 const close=openModal({title:label,contentEl:content,actions:[{label:'Confirmar progressão',closeOnClick:false,onClick:async()=>{if(busy)return;busy=true;try{if(!context.commitPreparedMutation)throw Error('Gravação preparada indisponível.');await context.commitPreparedMutation(plan,{label});close();returnFocus();}catch(error){status.textContent=error.message;}finally{busy=false;}}},{label:'Cancelar progressão',onClick:returnFocus}],onClose:returnFocus});
}

registerFieldType('progressionChoices',{
 search(context){
  const config=context.system.progressionChoices;if(!config)return [];const ledger=context.character.progressionLedger;
  return [{label:'Criação e evolução',value:ledger?.phase==='play'?'Criação concluída':'Criação em andamento'},...(ledger?.records||[]).map(record=>({label:record.label,value:description(record)}))];
 },
 render(container,context){
  const config=context.system.progressionChoices;if(!config)return;const character=()=>context.getCharacter?.()||context.character,host=node('section','','engine-progression');container.append(host);
  const focus=key=>()=>{const target=document.querySelector('.engine-progression button[data-progression-command="'+key+'"]')||document.querySelector('.engine-progression button');target?.focus();};
  const draw=()=>{
   host.replaceChildren();const current=character(),ledger=current.progressionLedger,phase=ledger?.phase||'creation';
   host.append(node('p',phase==='creation'?'Criação em andamento':'Criação concluída · evolução separada'));
   for(const id of [config.creationDataId,config.evolutionDataId]){const value=readData(context.system,current,id);host.append(node('p',dataDefinition(context.system,id).label+': '+(value.present?value.value:'Não informado')));}
   if(ledger?.creationSnapshot)host.append(node('p','Snapshot inicial: gastos '+ledger.creationSnapshot.spent+' · sobra '+ledger.creationSnapshot.remaining+' (não convertida em evolução)'));
   const history=node('div');for(const record of ledger?.records||[])history.append(node('p',description(record)));host.append(history);if(context.print)return;
   const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.append(status);const run=fn=>{try{fn();}catch(error){status.textContent=error.message;}};
   if(current.schemaVersion!==3){host.append(button('Habilitar progressão v3',async()=>{try{if(!await confirmDialog('Habilitar personagem v3 e preservar cópia do original?',{title:'Habilitar progressão',confirmLabel:'Habilitar v3'}))return;await context.upgradeActionCharacter();}catch(error){status.textContent=error.message;}}));return;}
   host.append(button(phase==='creation'?'Concluir criação tipada':'Reabrir criação tipada',()=>run(()=>review(context,prepareProgressionPhase(context.system,character(),phase==='creation'?'complete':'reopen'),phase==='creation'?'Concluir criação':'Reabrir criação',focus('phase'))),'phase'));
   for(const option of config.options){
    const allowed=option.modes.filter(mode=>phase==='creation'?mode==='creation':mode!=='creation');if(!allowed.length)continue;
    const section=node('section'),mode=node('select');mode.setAttribute('aria-label','Origem de '+option.label);for(const value of allowed){const item=node('option',modes[value]);item.value=value;mode.append(item);}section.append(node('h4',option.label),mode);const selections={};
    for(const choice of option.choices){const fieldset=node('fieldset');fieldset.append(node('legend',choice.label+' · escolha '+choice.minimum+' a '+choice.maximum));selections[choice.id]=new Set();for(const alternative of choice.options){const label=node('label',alternative.label),input=node('input');input.type='checkbox';input.setAttribute('aria-label',alternative.label+' em '+option.label);input.addEventListener('change',()=>{if(input.checked)selections[choice.id].add(alternative.id);else selections[choice.id].delete(alternative.id);});label.prepend(input);fieldset.append(label);}section.append(fieldset);}
    section.append(button('Revisar aquisição de '+option.label,()=>run(()=>review(context,prepareProgressionChoice(context.system,character(),{optionId:option.id,mode:mode.value,selections:Object.fromEntries(Object.entries(selections).map(([id,values])=>[id,[...values]]))}),'Adquirir '+option.label,focus('acquire:'+option.id))),'acquire:'+option.id));host.append(section);
   }
   for(const record of ledger?.records||[])if(record.status==='active')history.append(button('Revisar revogação de '+record.label,()=>run(()=>review(context,prepareProgressionRevocation(context.system,character(),record.id),'Revogar '+record.label,focus('revoke:'+record.id))),'revoke:'+record.id));
  };draw();context.registerRefresh?.(draw);
 }
});
