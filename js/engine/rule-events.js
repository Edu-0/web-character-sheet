import {dataDefinition,dataDefinitions,readData,writeData} from './data-definitions.js';
import {safeDataId} from './data-types.js';
import {compileActionFlow,prepareActionIntent,resolveActionIntent} from './action-plan.js';
import {predicateBindingIssue,predicateStatus} from './predicates.js';
import {validateActionRecords} from './action-records.js';
import {changesBetween,applyCharacterChanges} from './character-history.js';
import {validateDataDefinitions} from '../validation/data-definitions.js';
import {RESERVED_KEYS} from './paths.js';
import {compileTriggerInputs,triggerInputValues} from './event-inputs.js';

export const EVENT_LIMITS=Object.freeze({triggers:100,thresholds:100,waves:16,firings:100,roots:1000,events:100,proposals:100,bytes:262144});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=(v,allowed,label)=>{if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error(label+': parâmetros indisponíveis.');};
const withoutMeta=character=>{const {meta,...rest}=character;return rest;};
export function crossedThresholds(before,after,thresholds,direction='up',strict=false){
 if(typeof before!=='number'||!Number.isFinite(before)||typeof after!=='number'||!Number.isFinite(after))return [];
 return thresholds.filter(limit=>direction==='up'?(strict?before<=limit&&after>limit:before<limit&&after>=limit):(strict?before>=limit&&after<limit:before>limit&&after<=limit)).sort((a,b)=>direction==='up'?a-b:b-a);
}
export function compileTriggers(system){
 if(system.schemaVersion!==3)return [];const rows=system.ruleTriggers??[];if(!Array.isArray(rows)||rows.length>EVENT_LIMITS.triggers)throw Error('Use até100 definições de gatilhos.');const ids=new Set();
 const compiled=rows.map(trigger=>{
  keys(trigger,['version','id','label','enabled','origins','dataId','eventName','direction','strict','thresholds','dispatch','frequency','mode','actionId','priority','allowWhen','inputBindings'],'Gatilho');
  if(trigger.version!==1||!safeDataId(trigger.id)||ids.has(trigger.id)||typeof trigger.label!=='string'||!trigger.label.trim()||typeof trigger.enabled!=='boolean')throw Error('Gatilho exige versão, identidade única, nome e opt-in explícito.');ids.add(trigger.id);
  if(!Array.isArray(trigger.origins)||!trigger.origins.length||trigger.origins.some(v=>!['action','manual','event'].includes(v))||new Set(trigger.origins).size!==trigger.origins.length)throw Error('Escolha origens explícitas para o gatilho.');
  if(!['event','scene','character','rearm'].includes(trigger.frequency)||!['execute','propose'].includes(trigger.mode)||!Number.isSafeInteger(trigger.priority)||Math.abs(trigger.priority)>10000)throw Error('Frequência, modo e prioridade inválidos.');
  const action=(system.sheetActions||[]).find(a=>a.id===trigger.actionId);if(!action?.flow)throw Error('Escolha uma ação tipada existente.');compileActionFlow(system,action);
  if(trigger.mode==='execute'&&(action.flow.profile!=='preview'||action.flow.steps.some(s=>s.type==='resolve')))throw Error('Gatilho determinístico exige ação de prévia sem lançamentos; use proposta para escolhas/dados.');
  if(trigger.allowWhen){const issue=predicateBindingIssue(system,trigger.allowWhen,{collections:[]});if(issue)throw Error(issue);}
  if(trigger.eventName!==undefined){if(!safeDataId(trigger.eventName)||trigger.dataId!==undefined||trigger.thresholds!==undefined||trigger.frequency==='rearm'||trigger.origins.some(o=>o!=='event'))throw Error('Evento nomeado exige origem evento e não combina com cruzamento/rearmar.');}
  else{const row=dataDefinitions(system).find(r=>r.definition.id===trigger.dataId);if(!row||!['number','integer'].includes(row.definition.type)||row.ancestors.some(d=>d.type==='collection'))throw Error('Cruzamento exige dado numérico global.');if(!['up','down'].includes(trigger.direction)||typeof trigger.strict!=='boolean'||!['aggregate','each'].includes(trigger.dispatch)||!Array.isArray(trigger.thresholds)||!trigger.thresholds.length||trigger.thresholds.length>EVENT_LIMITS.thresholds||trigger.thresholds.some(v=>typeof v!=='number'||!Number.isFinite(v))||new Set(trigger.thresholds).size!==trigger.thresholds.length)throw Error('Direção, limites e agrupamento do cruzamento inválidos.');}
  compileTriggerInputs(system,trigger,action);return {trigger,action};
 });
 // All possible deterministic write paths participate, even currently disabled
 // branches. Proposals do not recursively execute the referenced action.
 const writes=row=>[...(row.action.flow.costs||[]).map(c=>c.dataId),...row.action.flow.steps.filter(s=>!['resolve','value'].includes(s.type)).map(s=>s.dataId)];
 const dataRows=dataDefinitions(system),changesObserved=(id,observed)=>id===observed||dataRows.find(r=>r.definition.id===observed)?.ancestors.some(d=>d.id===id);
 const visiting=new Set(),done=new Set();const visit=row=>{if(visiting.has(row.trigger.id))throw Error('Ciclo entre gatilhos determinísticos.');if(done.has(row.trigger.id))return;visiting.add(row.trigger.id);if(row.trigger.mode==='execute')for(const next of compiled)if(next.trigger.mode==='execute'&&next.trigger.origins.includes('action')&&writes(row).some(id=>changesObserved(id,next.trigger.dataId)))visit(next);visiting.delete(row.trigger.id);done.add(row.trigger.id);};compiled.forEach(visit);
 return compiled.sort((a,b)=>a.trigger.priority-b.trigger.priority||a.trigger.id.localeCompare(b.trigger.id,'en'));
}

export function validateEventState(character,root='character.ruleEventState'){
 if(character.ruleEventState===undefined)return [];const issues=[],add=message=>issues.push({path:root,code:'rule-events',message});
 try{
  if(character.schemaVersion!==3)throw Error('Estado de eventos exige personagem v3 explícito.');const state=character.ruleEventState;keys(state,['version','scene','roots','frequencies','proposals','events'],'Estado de eventos');
  if(state.version!==1||!Number.isSafeInteger(state.scene)||state.scene<0||!Array.isArray(state.roots)||state.roots.length>EVENT_LIMITS.roots||state.roots.some(v=>!safeDataId(v))||new Set(state.roots).size!==state.roots.length||!object(state.frequencies)||!Array.isArray(state.proposals)||state.proposals.length>EVENT_LIMITS.proposals)throw Error('Estado de eventos inválido ou acima do limite.');
  if(Object.keys(state.frequencies).length>EVENT_LIMITS.triggers)throw Error('Limite de marcadores de frequência excedido.');
  for(const [id,entry]of Object.entries(state.frequencies)){if(!safeDataId(id))throw Error('Identidade de marcador inválida.');keys(entry,['scene','character','armed'],'Marcador');if(typeof entry.character!=='boolean'||typeof entry.armed!=='boolean'||!Number.isSafeInteger(entry.scene)||entry.scene< -1)throw Error('Marcador de frequência inválido.');}
  const ids=new Set();for(const proposal of state.proposals){keys(proposal,['id','triggerId','actionId','eventId','origin','limits','label','before','after','inputs'],'Proposta');if(!safeDataId(proposal.id)||ids.has(proposal.id)||!safeDataId(proposal.triggerId)||!safeDataId(proposal.actionId)||!safeDataId(proposal.eventId)||!['action','manual','event'].includes(proposal.origin)||typeof proposal.label!=='string'||proposal.label.length>2000||!Array.isArray(proposal.limits)||proposal.limits.length>100||proposal.limits.some(v=>!Number.isFinite(v))||['before','after'].some(k=>proposal[k]!==undefined&&!Number.isFinite(proposal[k]))||proposal.inputs!==undefined&&(!object(proposal.inputs)||Object.keys(proposal.inputs).some(id=>!safeDataId(id))))throw Error('Proposta de evento inválida.');ids.add(proposal.id);}
  const events=state.events||[];if(!Array.isArray(events)||events.length>EVENT_LIMITS.events)throw Error('Limite de100 eventos registrados excedido.');const eventIds=new Set();
  for(const event of events){keys(event,['id','origin','scene','createdAt','eventName','causal','changes'],'Registro de evento');if(!safeDataId(event.id)||eventIds.has(event.id)||!state.roots.includes(event.id)||!['action','manual','event'].includes(event.origin)||!Number.isSafeInteger(event.scene)||event.scene<0||typeof event.createdAt!=='string'||!Number.isFinite(Date.parse(event.createdAt))||event.eventName!==undefined&&!safeDataId(event.eventName)||!Array.isArray(event.causal)||event.causal.length>EVENT_LIMITS.firings||!Array.isArray(event.changes)||event.changes.length>10000)throw Error('Registro de evento inválido.');eventIds.add(event.id);
   for(const cause of event.causal){keys(cause,['id','triggerId','actionId','eventId','origin','limits','label','before','after','mode','wave','changes','payments','inputs'],'Causa');if(!safeDataId(cause.id)||!safeDataId(cause.triggerId)||!safeDataId(cause.actionId)||!safeDataId(cause.eventId)||!['action','manual','event'].includes(cause.origin)||typeof cause.label!=='string'||cause.label.length>2000||!Array.isArray(cause.limits)||cause.limits.length>100||cause.limits.some(v=>!Number.isFinite(v))||!['execute','propose'].includes(cause.mode)||!Number.isSafeInteger(cause.wave)||cause.wave<0||cause.wave>=EVENT_LIMITS.waves||cause.changes!==undefined&&(!Array.isArray(cause.changes)||cause.changes.length>10000)||cause.payments!==undefined&&(!Array.isArray(cause.payments)||cause.payments.length>32))throw Error('Causa de evento inválida.');}
   for(const change of event.changes)if(!object(change)||typeof change.label!=='string'||change.label.length>2000||!Array.isArray(change.path)||!change.path.length||change.path.some(k=>typeof k!=='string'||!k||RESERVED_KEYS.has(k))||typeof change.beforeExists!=='boolean'||typeof change.afterExists!=='boolean'||change.beforeExists!==Object.hasOwn(change,'before')||change.afterExists!==Object.hasOwn(change,'after'))throw Error('Mudança registrada inválida.');
  }
  if(new TextEncoder().encode(JSON.stringify(state)).length>EVENT_LIMITS.bytes)throw Error('Estado de eventos excede256KiB.');
 }catch(error){add(error.message);}return issues;
}
export function assertEventBasis(character,plan,system){if(system&&plan.eventDefinition!==undefined&&plan.eventDefinition!==JSON.stringify(system))throw Error('O sistema mudou após a prévia causal.');if(plan.eventBasis&&!same(withoutMeta(character),plan.eventBasis))throw Error('A ficha mudou após a prévia causal; prepare novamente.');}
function assertCandidate(system,candidate){const issues=[...validateDataDefinitions(system,candidate,'character'),...validateEventState(candidate),...validateActionRecords(candidate)];if(issues.length)throw Error(issues[0].message);}
function overlap(a,b){return a.every((v,i)=>b[i]===v)||b.every((v,i)=>a[i]===v);}

// Simulate on clones; the returned presence patches are committed only by the
// existing action/history writer. Never subscribed to render/load/import.
export function prepareEventChain(system,character,rootPlan,{origin='action',eventName,id=rootPlan.id,resetScene=false}={}){
 const compiled=compileTriggers(system);if(!compiled.some(r=>r.trigger.enabled&&r.trigger.origins.includes(origin))&&!eventName)return rootPlan;
 if(character.schemaVersion!==3||!safeDataId(id)||!['action','manual','event'].includes(origin))throw Error('Evento exige personagem v3, origem e identidade explícitos.');
 if(eventName!==undefined&&(!safeDataId(eventName)||origin!=='event'))throw Error('Evento nomeado inválido.');
 const source=structuredClone(character),draft=structuredClone(character);applyCharacterChanges(draft,rootPlan.patches,{validate:value=>assertCandidate(system,value)});
 const state=structuredClone(character.ruleEventState??{version:1,scene:0,roots:[],frequencies:{},proposals:[],events:[]});if(state.roots.includes(id))throw Error('Evento já comprometido; não repetir consequências.');if(state.roots.length>=EVENT_LIMITS.roots||(state.events?.length||0)>=EVENT_LIMITS.events)throw Error('Limite de eventos atingido; arquive explicitamente os concluídos com cópia de recuperação.');state.events??=[];
 if(resetScene){if(origin!=='event')throw Error('Cena exige evento explícito.');state.scene++;}state.roots.push(id);draft.ruleEventState=state;
 const causal=[],visited=new Set(),evaluationBudget={remaining:100000-(rootPlan.evaluationSteps||0)};let firings=0,wave=0,before=source,after=structuredClone(draft),currentOrigin=origin;
 do{
  if(wave>=EVENT_LIMITS.waves)throw Error('Limite de16 ondas de gatilhos excedido.');const jobs=[];
  for(const {trigger,action}of compiled){if(!trigger.enabled||!trigger.origins.includes(currentOrigin))continue;const marker=state.frequencies[trigger.id]??={scene:-1,character:false,armed:true};
   let limits=[],oldValue,newValue;
   if(trigger.eventName){if(wave!==0||trigger.eventName!==eventName)continue;limits=[null];}
   else{const old=readData(system,before,trigger.dataId),next=readData(system,after,trigger.dataId);oldValue=old.present?old.value:undefined;newValue=next.present?next.value:undefined;limits=crossedThresholds(oldValue,newValue,trigger.thresholds,trigger.direction,trigger.strict);
    if(trigger.frequency==='rearm'&&crossedThresholds(oldValue,newValue,trigger.thresholds,trigger.direction==='up'?'down':'up',false).length)marker.armed=true;
   }
   if(!limits.length||trigger.frequency==='scene'&&marker.scene===state.scene||trigger.frequency==='character'&&marker.character||trigger.frequency==='rearm'&&!marker.armed)continue;
   const permission=predicateStatus(system,after,trigger.allowWhen,{budget:evaluationBudget});if(permission.error)throw Error(permission.message);if(!permission.allowed)continue;
   const groups=trigger.dispatch==='each'?limits.map(v=>[v]):[limits];for(const crossed of groups){if(++firings>EVENT_LIMITS.firings)throw Error('Limite de100 disparos por cadeia excedido.');const key=trigger.id+'-'+crossed.join('_');if(visited.has(key))throw Error('Reentrada do mesmo gatilho na cadeia.');visited.add(key);
    const childId='event-'+crypto.randomUUID(),trace={id:childId,triggerId:trigger.id,actionId:action.id,eventId:id,origin:currentOrigin,limits:crossed.filter(v=>v!==null),label:trigger.label,...(oldValue!==undefined?{before:oldValue}:{}),...(newValue!==undefined?{after:newValue}:{})};trace.inputs=triggerInputValues(system,trigger,action,{...trace,scene:state.scene});
    if(trigger.mode==='propose'){if(state.proposals.length>=EVENT_LIMITS.proposals)throw Error('Limite de100 propostas atingido; resolva ou dispense propostas explicitamente.');state.proposals.push(trace);causal.push({...trace,mode:'propose',wave});}
    else{const intent=prepareActionIntent(system,after,action,{id:childId,evaluationBudget,inputs:trace.inputs}),plan=resolveActionIntent(system,after,action,intent,{evaluationBudget,die:()=>{throw Error('Gatilho determinístico não lança dados.');}});jobs.push({trace,plan});causal.push({...trace,mode:'execute',wave,changes:plan.changes,payments:plan.payments});}
   }marker.scene=state.scene;marker.character=true;marker.armed=false;
  }
  const paths=[];for(const {plan}of jobs)for(const patch of plan.patches){if(paths.some(path=>overlap(path,patch.path)))throw Error('Gatilhos da mesma onda escrevem destinos sobrepostos; declare composição em uma ação.');paths.push(patch.path);}
  before=after;for(const {plan}of jobs)applyCharacterChanges(draft,plan.patches,{validate:value=>assertCandidate(system,value)});after=structuredClone(draft);currentOrigin='action';wave++;
  if(!jobs.length)break;
 }while(!same(withoutMeta(before),withoutMeta(after)));
 const logChanges=changesBetween(source,draft).filter(p=>!['actionRecords','ruleEventState'].includes(p.path[0])).map(p=>{const row=dataDefinitions(system).find(r=>[...r.ancestors.map(d=>d.binding),r.definition.binding].join('.')===p.path.join('.'));return {...p,label:(row?.definition.label||'Dado da ficha').slice(0,2000)};});state.events.push({id,origin,scene:state.scene,createdAt:new Date().toISOString(),...(eventName?{eventName}:{}),causal:structuredClone(causal),changes:logChanges});assertCandidate(system,draft);
 // Keep the root record compact, with inspectable causal consequences. Child
 // effects remain presence patches, not a second writer or replayable scripts.
 if(rootPlan.recordChange){const record=draft.actionRecords.find(r=>r.id===rootPlan.id);record.extensions={...(record.extensions||{}),causal};}
 assertCandidate(system,draft);const patches=changesBetween(source,draft),record=rootPlan.recordChange?draft.actionRecords.find(r=>r.id===rootPlan.id):null;
 return {...rootPlan,patches,changes:patches.filter(p=>p.path[0]!=='actionRecords').map(p=>({...p,field:p.path.join('.')})),eventBasis:withoutMeta(source),causal,
  eventDefinition:JSON.stringify(system),...(record?{recordChange:{...rootPlan.recordChange,after:structuredClone(record)}}:{}),details:[...(rootPlan.details||[]),...causal.map(c=>c.label+': '+(c.mode==='propose'?'proposta guardada':'consequência incluída')+(c.limits.length?' (limites '+c.limits.join(', ')+')':'')+'.')]};
}
export function prepareManualEvent(system,character,dataId,cell,{id=crypto.randomUUID()}={}){dataDefinition(system,dataId);const draft=structuredClone(character);writeData(system,draft,dataId,cell);assertCandidate(system,draft);return prepareEventChain(system,character,{version:1,id,source:structuredClone(character),eventBasis:structuredClone(withoutMeta(character)),eventDefinition:JSON.stringify(system),patches:changesBetween(character,draft),details:[]},{origin:'manual',id});}
export function prepareNamedEvent(system,character,eventName,{id=crypto.randomUUID(),resetScene=false}={}){return prepareEventChain(system,character,{version:1,id,source:structuredClone(character),patches:[],details:[]},{origin:'event',eventName,id,resetScene});}

export function prepareEventStateChange(system,character,{dismissId,archiveRoots=false}={}){
 const draft=structuredClone(character);if(!draft.ruleEventState)throw Error('Nenhum estado de eventos guardado.');
 if(dismissId!==undefined){if(!draft.ruleEventState.proposals.some(p=>p.id===dismissId))throw Error('Proposta mudou ou já foi resolvida.');if(draft.actionRecords?.some(r=>r.phase!=='complete'&&r.extensions?.proposal?.id===dismissId))throw Error('A proposta tem ativação pendente; retome a execução antes de dispensar.');draft.ruleEventState.proposals=draft.ruleEventState.proposals.filter(p=>p.id!==dismissId);}
 if(archiveRoots){draft.ruleEventState.roots=[];draft.ruleEventState.events=[];}assertCandidate(system,draft);
 return {version:1,id:crypto.randomUUID(),source:structuredClone(character),eventBasis:structuredClone(withoutMeta(character)),eventDefinition:JSON.stringify(system),patches:changesBetween(character,draft),details:[]};
}
export function bindEventProposal(system,character,rootPlan,proposalId,actionId){
 if(!proposalId)return rootPlan;const proposal=character.ruleEventState?.proposals.find(p=>p.id===proposalId);if(!proposal||proposal.actionId!==actionId||rootPlan.stage!=='activation')throw Error('Proposta mudou ou não corresponde à ativação.');if(character.actionRecords?.some(r=>r.phase!=='complete'&&r.extensions?.proposal?.id===proposalId&&r.id!==rootPlan.id))throw Error('Proposta já tem execução pendente; retome sem pagar outra vez.');
 const draft=structuredClone(character);applyCharacterChanges(draft,rootPlan.patches);const record=draft.actionRecords.find(r=>r.id===rootPlan.id);record.extensions={...(record.extensions||{}),proposal:structuredClone(proposal)};assertCandidate(system,draft);
 return {...rootPlan,patches:changesBetween(character,draft),eventBasis:structuredClone(withoutMeta(character)),eventDefinition:JSON.stringify(system),recordChange:{...rootPlan.recordChange,after:structuredClone(record)}};
}
export function completeEventProposal(system,character,rootPlan,proposalId,actionId){
 if(!proposalId)return rootPlan;const proposal=character.ruleEventState?.proposals.find(p=>p.id===proposalId);if(!proposal||proposal.actionId!==actionId||rootPlan.stage!=='complete')throw Error('Proposta mudou ou não corresponde à ação preparada.');
 const draft=structuredClone(character);applyCharacterChanges(draft,rootPlan.patches);draft.ruleEventState.proposals=draft.ruleEventState.proposals.filter(p=>p.id!==proposalId);
 const record=draft.actionRecords.find(r=>r.id===rootPlan.id);record.extensions={...(record.extensions||{}),proposal:structuredClone(proposal)};assertCandidate(system,draft);
 const patches=changesBetween(character,draft);return {...rootPlan,patches,eventBasis:structuredClone(withoutMeta(character)),eventDefinition:JSON.stringify(system),recordChange:{...rootPlan.recordChange,after:structuredClone(record)},changes:patches.filter(p=>p.path[0]!=='actionRecords').map(p=>({...p,field:p.path.join('.')}))};
}
