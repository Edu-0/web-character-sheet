import {dataDefinition} from './data-definitions.js';
import {safeDataId,typedValueIssue} from './data-types.js';
export const EVENT_INPUT_PORTS=Object.freeze({before:'Valor anterior',after:'Valor posterior',limit:'Limite desta execução',limits:'Lista de limites cruzados',count:'Quantidade de limites',scene:'Número da cena explícita',directionUp:'Cruzamento ascendente',origin:'Origem da transição',eventId:'Identidade do evento raiz'});
export function compileTriggerInputs(system,trigger,action){
 const bindings=trigger.inputBindings||[];if(!Array.isArray(bindings)||bindings.length>32)throw Error('Use até32 vínculos de entrada do evento.');const ids=new Set(),inputs=action.flow.inputs||[];
 const observed=trigger.dataId?dataDefinition(system,trigger.dataId):null;
 const rows=bindings.map(binding=>{if(!binding||typeof binding!=='object'||Array.isArray(binding)||Object.keys(binding).some(k=>!['inputId','port'].includes(k))||!safeDataId(binding.inputId)||ids.has(binding.inputId)||!Object.hasOwn(EVENT_INPUT_PORTS,binding.port))throw Error('Vínculo de entrada do evento inválido ou duplicado.');ids.add(binding.inputId);const input=inputs.find(d=>d.id===binding.inputId);if(!input)throw Error('Entrada do evento não pertence à ação.');
  if(['before','after','limit','limits','directionUp'].includes(binding.port)&&!observed)throw Error('Esta fonte exige cruzamento numérico.');
  const integer=['count','scene'].includes(binding.port)||['before','after'].includes(binding.port)&&observed?.type==='integer'||binding.port==='limit'&&trigger.thresholds?.every(Number.isSafeInteger);
  const numeric=['before','after','limit','count','scene'].includes(binding.port);
  if(numeric&&!(input.type==='number'||input.type==='integer'&&integer)||['origin','eventId'].includes(binding.port)&&input.type!=='string'||binding.port==='directionUp'&&input.type!=='boolean')throw Error('Tipo da entrada incompatível com a fonte do evento.');
  if(binding.port==='limit'&&trigger.dispatch!=='each')throw Error('Limite individual exige execução por limite; use lista/contagem na agregação.');
  if(binding.port==='limits'&&!(input.type==='collection'&&input.fields?.length===1&&['number','integer'].includes(input.fields[0].type)&&(input.fields[0].type==='number'||trigger.thresholds.every(Number.isSafeInteger))))throw Error('Lista de limites exige coleção com um campo numérico compatível.');
  return {binding,input};
 });
 if(trigger.mode==='execute'&&inputs.some(d=>d.required&&!ids.has(d.id)))throw Error('Toda entrada obrigatória da ação automática precisa de um vínculo do evento.');return rows;
}
export function triggerInputValues(system,trigger,action,event){
 const result={};for(const {binding,input}of compileTriggerInputs(system,trigger,action)){const port=binding.port,value=port==='limits'?event.limits.map((limit,index)=>({id:'limit-'+index,[input.fields[0].binding]:limit})):port==='limit'?event.limits[0]:port==='count'?event.limits.length:port==='directionUp'?trigger.direction==='up':event[port];const issue=typedValueIssue(input,value);if(issue)throw Error(input.label+': '+issue);result[input.id]=structuredClone(value);}return result;
}
