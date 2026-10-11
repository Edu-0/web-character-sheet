import {evaluateRule} from './rule-registry.js';
import {dataDefinitions} from './data-definitions.js';

// A predicate is a shared pure boolean rule. Presentation never grants execution.
export function predicateBindingIssue(system,binding,{collections=null}={}){
 if(system?.schemaVersion!==3)return 'Condição tipada exige sistema v3.';
 if(!binding||typeof binding!=='object'||Array.isArray(binding)||typeof binding.ruleId!=='string'||Object.keys(binding).some(k=>!['ruleId','message'].includes(k)))return 'Use uma condição compartilhada por ruleId e mensagem opcional.';
 if(binding.message!==undefined&&(typeof binding.message!=='string'||binding.message.length>2000))return 'Mensagem da condição deve ser texto de até2000 caracteres.';
 const rule=(Array.isArray(system.rules)?system.rules:[]).find(r=>r.id===binding.ruleId);if(!rule||rule.resultType!=='boolean')return 'Condição exige regra existente com resultado Sim/Não.';
 if(collections!==null&&rule.context){const row=dataDefinitions(system).find(r=>r.definition.id===rule.context.dataId),scopes=[...(row?.ancestors||[]).filter(d=>d.type==='collection').map(d=>d.id),rule.context.dataId];if(scopes.some(id=>!collections.includes(id)))return rule.label+': condição exige contexto de entrada compatível.';}
 return null;
}
export function predicateStatus(system,character,binding,options={}){
 if(binding===undefined)return {allowed:true,value:true,message:''};
 const label=(Array.isArray(system.rules)?system.rules:[]).find(r=>r.id===binding?.ruleId)?.label||'Condição';
 try{const issue=predicateBindingIssue(system,binding);if(issue)throw Error(issue);const value=evaluateRule(system,character,binding.ruleId,options);if(typeof value!=='boolean')throw Error('Resultado da condição deve ser Sim/Não.');return {allowed:value,value,message:value?'':binding.message||label+': condição não atendida.'};}
 catch(error){return {allowed:false,error:true,message:label+': '+error.message};}
}
export function requirePredicate(system,character,binding,options={}){const status=predicateStatus(system,character,binding,options);if(!status.allowed)throw Error(status.message);return status;}
export function componentPresentation(component,system,character,options={}){
 const consumers=[...(component.groupTrail||[]),component],result={visible:{allowed:true,message:''},editable:{allowed:true,message:''}};
 for(const [kind,slot]of [['visible','visibleWhen'],['editable','editableWhen']])for(const consumer of consumers)if(consumer[slot]!==undefined){
  const status=predicateStatus(system,character,consumer[slot],{...options,dataContext:consumer.dataContext??component.dataContext});if(!status.allowed){result[kind]=status;break;}
 }
 return result;
}
