import {compileTypedEffect,typedEffectDefinition} from './typed-effect-contract.js';
import {safeDataId} from './data-types.js';
import {requirePredicate} from './predicates.js';
import {changesBetween} from './character-history.js';

export function activateTypedEffect(system,character,definitionId,{id=crypto.randomUUID(),budget,onRead,provenance}={}){
 if(character.schemaVersion!==3)throw Error('Habilite personagem v3 explicitamente antes de ativar projeção tipada.');const definition=system.effectDefinitions?.find(d=>d.id===definitionId);if(!typedEffectDefinition(definition))throw Error('Definição de efeito tipado inexistente.');compileTypedEffect(system,definition);
 if(!safeDataId(id)||(character.activeEffects||[]).some(e=>e.id===id))throw Error('Identidade de instância inválida ou duplicada.');const active=(character.activeEffects||[]).filter(i=>i.status==='active'),own=active.filter(i=>i.definitionId===definitionId);
 if((character.activeEffects?.length||0)>=100)throw Error('Limite de100 instâncias; encerre e remova explicitamente.');if(definition.stacking.mode==='unique'&&own.length||definition.stacking.mode==='stack'&&own.length>=definition.stacking.limit)throw Error('Limite de empilhamento deste efeito atingido.');
 if(definition.group)for(const instance of active){const other=system.effectDefinitions?.find(d=>d.id===instance.definitionId);if(other?.group!==definition.group)continue;if(!typedEffectDefinition(other)||definition.stacking.mode==='exclusive'||other.stacking.mode==='exclusive'||other.stacking.mode!==definition.stacking.mode)throw Error('Grupo de efeitos exige política compatível ou encerramento explícito.');}
 requirePredicate(system,character,definition.allowWhen,{budget,onRead});
 const instance={id,profile:'typed',definitionId,definitionRevision:definition.revision,labelSnapshot:definition.label,status:'active',duration:{...structuredClone(definition.duration),...(definition.duration.type!=='manual'?{remaining:definition.duration.count}:{})},...(provenance?{provenance:structuredClone(provenance)}:{})};character.activeEffects??=[];character.activeEffects.push(instance);return instance;
}

export function consumeTypedEffects(system,character,ids,{committedResolution=false,success=false,eventName}={}){
 const selected=new Set(ids||[]),changed=[];
 for(const instance of character.activeEffects||[]){if(instance.profile!=='typed'||instance.status!=='active')continue;const definition=system.effectDefinitions?.find(d=>d.id===instance.definitionId);if(!typedEffectDefinition(definition)||definition.revision!==instance.definitionRevision)throw Error('Instância tipada exige revisão disponível antes de consumo.');const duration=instance.duration;
  if(duration.type==='uses'&&committedResolution&&selected.has(instance.id)&&duration.consume==='success'&&typeof success!=='boolean')throw Error('Consumo por sucesso exige condição final de sucesso declarada na ação.');
  const use=duration.type==='uses'&&committedResolution&&selected.has(instance.id)&&(duration.consume==='committedResolution'||duration.consume==='success'&&success),event=duration.type==='untilEvent'&&eventName!==undefined&&eventName===duration.eventName;if(!use&&!event)continue;
  if(!Number.isSafeInteger(duration.remaining)||duration.remaining<1)throw Error('Contador de efeito inválido.');const before=duration.remaining;duration.remaining--;if(duration.remaining===0)instance.status='expired';changed.push({id:instance.id,label:instance.labelSnapshot,before,after:duration.remaining,status:instance.status});
 }return changed;
}

export function validateTypedEffectInstance(instance,definition,{system,characterVersion=3}={}){
 const issues=[],add=message=>issues.push(message),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(!object(instance))return ['Instância tipada exige objeto.'];if(characterVersion!==3)add('Instância tipada exige personagem v3.');
 if(Object.keys(instance).some(k=>!['id','profile','definitionId','definitionRevision','labelSnapshot','status','duration','provenance','extensions','extra'].includes(k))||instance.profile!=='typed'||!safeDataId(instance.id)||!safeDataId(instance.definitionId)||typeof instance.labelSnapshot!=='string'||instance.labelSnapshot.length>2000||!Number.isSafeInteger(instance.definitionRevision)||instance.definitionRevision<1||!['active','inactive','expired'].includes(instance.status))add('Identidade, perfil ou estado de instância tipada inválido.');
 const duration=instance.duration;if(!object(duration)||!['manual','uses','untilEvent'].includes(duration.type))return [...issues,'Duração tipada inválida.'];
 if(duration.type==='manual'){if(Object.keys(duration).some(k=>k!=='type'))add('Manual não recebe contador/evento.');}
 else{if(Object.keys(duration).some(k=>!['type','count','remaining',duration.type==='uses'?'consume':'eventName'].includes(k)))add('Parâmetro de duração indisponível.');if(!Number.isSafeInteger(duration.count)||duration.count<1||duration.count>1000||!Number.isSafeInteger(duration.remaining)||duration.remaining<0||duration.remaining>duration.count||instance.status==='active'&&duration.remaining===0)add('Contador tipado inválido.');if(duration.type==='uses'&&!['committedResolution','success'].includes(duration.consume)||duration.type==='untilEvent'&&!safeDataId(duration.eventName))add('Evento/consumo tipado inválido.');}
 if(definition&&definition.revision===instance.definitionRevision){try{compileTypedEffect(system,definition);}catch(error){add(error.message);}const {remaining,...snapshot}=duration;if(JSON.stringify(Object.fromEntries(Object.entries(snapshot).sort()))!==JSON.stringify(Object.fromEntries(Object.entries(definition.duration).sort())))add('Duração não corresponde à revisão da definição.');}
 return issues;
}

export function prepareTypedEffectChange(system,character,{type,definitionId,instanceId,id=crypto.randomUUID()}={}){
 const draft=structuredClone(character);if(type==='activate')activateTypedEffect(system,draft,definitionId,{id});
 else{const instance=draft.activeEffects?.find(i=>i.id===instanceId);if(!instance||instance.profile!=='typed')throw Error('Instância tipada inexistente.');if(type==='remove'){if(instance.status==='active')throw Error('Encerre antes de remover.');draft.activeEffects=draft.activeEffects.filter(i=>i.id!==instanceId);}else if(type==='end')instance.status='inactive';else throw Error('Mudança de efeito indisponível.');}
 const {meta,...basis}=structuredClone(character);return {version:1,id,source:structuredClone(character),eventBasis:basis,eventDefinition:JSON.stringify(system),patches:changesBetween(character,draft),details:[]};
}
