import {compileTypedEffect,typedEffectDefinition} from './typed-effect-contract.js';
import {projectTypedCell} from './typed-effect-projection.js';
import {evaluateCompiledActionExpression} from './action-expression.js';
import {evaluateRule} from './rule-registry.js';
import {dataDefinition} from './data-definitions.js';

const sameTarget=(a,b)=>a.kind===b.kind&&(a.kind==='data'?a.dataId===b.dataId:a.ruleId===b.ruleId);
const scoreType=definition=>['highest','lowest'].includes(definition.stacking.mode);
export function projectTypedTarget(system,character,target,base,{budget,projectionStack=new Set(),onRead=()=>{},onEffectUse=()=>{}}={}){
 if(system.schemaVersion!==3||!(system.effectDefinitions||[]).some(typedEffectDefinition))return {cell:structuredClone(base),applied:[],suppressed:[],trace:[]};
 const key=target.kind+':'+(target.dataId||target.ruleId);if(projectionStack.has(key))throw Error('Ciclo de projeção efetiva durante execução.');projectionStack.add(key);
 try{
  const entries=[],suppressed=[],shared=budget||{remaining:100000};
  for(const instance of character.activeEffects||[]){
   if(instance.status!=='active')continue;const definition=system.effectDefinitions.find(d=>d.id===instance.definitionId);
   if(!typedEffectDefinition(definition))continue;
   if(!definition.operations.some(op=>sameTarget(op.target,target)))continue;
   if(instance.profile!=='typed'||instance.definitionRevision!==definition.revision)throw Error('Instância de efeito tipado exige revisão atual; preserve ou encerre explicitamente.');
   const compiled=compileTypedEffect(system,definition),options={budget:shared,projectionSystem:system,projectionStack,onRead,onEffectUse};
   if(definition.when&&!evaluateRule(system,character,definition.when.ruleId,options)){suppressed.push({instanceId:instance.id,label:definition.label,reason:'Condição não atendida.'});continue;}
   for(const row of compiled.operations.filter(r=>sameTarget(r.operation.target,target))){entries.push({instanceId:instance.id,label:definition.label,priority:definition.priority,definition,operation:row.operation,compiledExpression:row.expression,evaluationOptions:options});}
  }
  const groups=new Map();for(const entry of entries){const key=entry.definition.group||entry.definition.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
  const selected=[];for(const values of groups.values()){
   const ranked=values.filter(e=>scoreType(e.definition));if(!ranked.length){selected.push(...values);continue;}
   if(ranked.length!==values.length||new Set(ranked.map(e=>e.definition.stacking.mode)).size!==1)throw Error('Políticas de empilhamento incompatíveis no grupo.');const mode=ranked[0].definition.stacking.mode;
   for(const entry of ranked){entry.value=evaluateCompiledActionExpression(entry.compiledExpression,character,entry.evaluationOptions);if(typeof entry.value!=='number'||!Number.isFinite(entry.value))throw Error('Maior/menor exige magnitude numérica finita.');entry.operation={...entry.operation,expression:undefined,value:entry.value};}
   ranked.sort((a,b)=>(mode==='highest'?b.value-a.value:a.value-b.value)||a.instanceId.localeCompare(b.instanceId,'en'));selected.push(ranked[0]);for(const entry of ranked.slice(1))suppressed.push({instanceId:entry.instanceId,label:entry.label,reason:mode==='highest'?'Magnitude menor ou equivalente.':'Magnitude maior ou equivalente.'});
  }
  const definition=target.kind==='data'?dataDefinition(system,target.dataId):{id:target.ruleId,label:system.rules.find(r=>r.id===target.ruleId).label,type:system.rules.find(r=>r.id===target.ruleId).resultType,required:false,nullable:false};
  const result=projectTypedCell(definition,base,selected,{evaluate:(_,entry)=>evaluateCompiledActionExpression(entry.compiledExpression,character,entry.evaluationOptions)});for(const id of result.applied)onEffectUse(id);return {...result,suppressed:[...suppressed,...result.suppressed]};
 }finally{projectionStack.delete(key);}
}
