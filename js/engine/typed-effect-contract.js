import {dataDefinitions} from './data-definitions.js';
import {safeDataId} from './data-types.js';
import {compileActionExpression} from './action-expression.js';
import {predicateBindingIssue} from './predicates.js';

export const TYPED_EFFECT_OPERATIONS=Object.freeze(['replace','multiply','add','clamp','shiftTrait']);
export const TYPED_EFFECT_STACKING=Object.freeze(['unique','stack','highest','lowest','exclusive']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed,label)=>{if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error(label+': parâmetros indisponíveis.');};
const integer=(value,label,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(label+': inteiro fora do intervalo permitido.');};
export const typedEffectDefinition=definition=>definition?.profile==='typed';

export function typedEffectTarget(system,target){
 keys(target,['kind','dataId','ruleId'],'Alvo de efeito');
 if(target.kind==='data'){
  if(target.ruleId!==undefined)throw Error('Escolha um único alvo de efeito.');const row=dataDefinitions(system).find(r=>r.definition.id===target.dataId);
  if(!row||row.ancestors.some(d=>d.type==='collection')||!['number','integer','boolean','enum','trait','string'].includes(row.definition.type))throw Error('Efeito exige dado escalar/traço global compatível.');return row.definition;
 }
 if(target.kind==='rule'){
  if(target.dataId!==undefined)throw Error('Escolha um único alvo de efeito.');const rule=system.rules?.find(r=>r.id===target.ruleId);
  if(!rule||rule.kind!=='calculation'||rule.context)throw Error('Efeito exige cálculo global existente.');return {id:rule.id,label:rule.label,type:rule.resultType,required:false,nullable:false};
 }
 throw Error('Alvo exige dado ou cálculo tipado.');
}
export function compileTypedEffect(system,definition){
 if(system.schemaVersion!==3)throw Error('Projeção tipada exige sistema v3.');
 keys(definition,['profile','version','id','label','revision','priority','stacking','group','duration','allowWhen','when','operations','extensions'],'Efeito tipado');
 if(definition.profile!=='typed'||definition.version!==1||!safeDataId(definition.id)||typeof definition.label!=='string'||!definition.label.trim()||definition.label.length>2000)throw Error('Efeito tipado exige perfil, versão, identidade e nome.');integer(definition.revision,'Revisão',1,1000000);integer(definition.priority,'Prioridade',-10000,10000);
 keys(definition.stacking,['mode','limit'],'Empilhamento');if(!TYPED_EFFECT_STACKING.includes(definition.stacking.mode))throw Error('Empilhamento indisponível.');
 if(definition.stacking.mode==='stack')integer(definition.stacking.limit,'Limite de instâncias',1,100);else if(definition.stacking.limit!==undefined)throw Error('Limite só pertence ao modo acumular.');
 if(definition.group!==undefined&&!safeDataId(definition.group)||definition.stacking.mode==='exclusive'&&!definition.group)throw Error('Grupo exclusivo exige identidade estável.');
 keys(definition.duration,['type','count','consume','eventName'],'Duração');if(!['manual','uses','untilEvent'].includes(definition.duration.type))throw Error('Duração indisponível.');
 if(definition.duration.type==='manual'){if(Object.keys(definition.duration).some(k=>k!=='type'))throw Error('Manual não recebe contador/evento.');}
 else{integer(definition.duration.count,'Quantidade de usos/eventos',1,1000);if(definition.duration.type==='uses'){if(!['committedResolution','success'].includes(definition.duration.consume)||definition.duration.eventName!==undefined)throw Error('Declare consumo em resolução comprometida ou sucesso.');}else if(!safeDataId(definition.duration.eventName)||definition.duration.consume!==undefined)throw Error('Duração por evento exige identidade do evento e contador.');}
 for(const binding of [definition.allowWhen,definition.when])if(binding!==undefined){const issue=predicateBindingIssue(system,binding,{collections:[]});if(issue)throw Error(issue);}
 if(!Array.isArray(definition.operations)||!definition.operations.length||definition.operations.length>20)throw Error('Use de1 a20 operações de efeito.');const ids=new Set();
 const operations=definition.operations.map(operation=>{
  keys(operation,['id','type','target','expression','minimum','maximum','selection','index','bounds'],'Operação de efeito');if(!safeDataId(operation.id)||ids.has(operation.id)||!TYPED_EFFECT_OPERATIONS.includes(operation.type))throw Error('Operação exige identidade única e tipo permitido.');ids.add(operation.id);const target=typedEffectTarget(system,operation.target),numeric=['number','integer'].includes(target.type);
  if(['add','multiply','clamp'].includes(operation.type)&&!numeric)throw Error('Operação numérica exige alvo numérico; traços têm passos próprios.');if(operation.type==='shiftTrait'&&target.type!=='trait')throw Error('Passos exigem alvo de traço.');
  if(operation.type==='clamp'){if(operation.expression!==undefined||operation.minimum===undefined&&operation.maximum===undefined||['minimum','maximum'].some(k=>operation[k]!==undefined&&(typeof operation[k]!=='number'||!Number.isFinite(operation[k])))||operation.minimum!==undefined&&operation.maximum!==undefined&&operation.minimum>operation.maximum)throw Error('Declare limites numéricos compatíveis.');}
  else if(operation.minimum!==undefined||operation.maximum!==undefined)throw Error('Limites só pertencem à operação limitar.');
  if(operation.type==='shiftTrait'){if(!['all','highest','lowest','index'].includes(operation.selection)||!['clamp','reject'].includes(operation.bounds))throw Error('Declare seleção do dado e política de borda.');if(operation.selection==='index')integer(operation.index,'Posição do dado',0,7);else if(operation.index!==undefined)throw Error('Posição só pertence à seleção por índice.');}
  else if(operation.selection!==undefined||operation.index!==undefined||operation.bounds!==undefined)throw Error('Seleção/borda só pertencem aos passos de traço.');
  const expected=operation.type==='replace'?(target.type==='integer'?'number':target.type):'number',expression=operation.type==='clamp'?null:compileActionExpression(system,operation.expression,expected,{...(operation.type==='replace'?{expectedDefinition:target}:{}),label:definition.label});
  return {operation,target,expression};
 });
 if(['highest','lowest'].includes(definition.stacking.mode)&&(operations.length!==1||!['replace','add','multiply'].includes(operations[0].operation.type)||!['number','integer'].includes(operations[0].target.type)))throw Error('Maior/menor exige uma operação numérica com magnitude declarada.');
 return {definition,operations};
}

// Read the complete graph, including branches not taken now. Base reads do not
// depend on projections; effective reads, rule sources and conditions do.
export function validateTypedEffectDependencies(system){
 const effects=(system.effectDefinitions||[]).filter(typedEffectDefinition),graph=new Map(),edge=(a,b)=>{if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(b);};
 const expressionEdges=(from,node)=>{if(!object(node))return;if(node.op==='read'&&node.mode==='effective')edge(from,'data:'+node.dataId);if(node.op==='rule')edge(from,'rule:'+node.ruleId);for(const value of Object.values(node))if(object(value))expressionEdges(from,value);else if(Array.isArray(value))for(const item of value)expressionEdges(from,item);};
 for(const rule of system.rules||[])expressionEdges('rule:'+rule.id,rule.expression);
 for(const definition of effects){compileTypedEffect(system,definition);const effect='effect:'+definition.id;if(definition.when)edge(effect,'rule:'+definition.when.ruleId);for(const operation of definition.operations){edge(operation.target.kind+':'+(operation.target.dataId||operation.target.ruleId),effect);expressionEdges(effect,operation.expression);}}
 const active=new Set(),done=new Set();const visit=(id,depth=0)=>{if(active.has(id))throw Error('Ciclo entre efeito, cálculo e condição.');if(depth>128)throw Error('Profundidade de dependências de efeito excedida.');if(done.has(id))return;active.add(id);for(const next of graph.get(id)||[])visit(next,depth+1);active.delete(id);done.add(id);};for(const id of graph.keys())visit(id);return true;
}
