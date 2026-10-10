import {generatedKey} from './data-index.js';
import {DATA_TYPES, BOUND_COMPONENT_TYPES} from '../engine/data-definitions.js';
import {valueAt} from './form-structure.js';
import {RULE_OPERATIONS} from '../engine/rule-registry.js';
const uuid=prefix=>prefix+'-'+crypto.randomUUID();
export function createTypedDataPlan(pkg,{name,type='number',required=false,nullable=false,hasInitial=false,initial}) {
  if(pkg.system.schemaVersion!==3 || pkg.schemaVersion!==3)throw new Error('Criação de dados tipados exige pacote v3. Abra um pacote novo; a abertura não converte documentos antigos.');
  if(!name?.trim() || !DATA_TYPES.includes(type))throw new Error('Informe nome e tipo do dado.');
  const binding=generatedKey(name,[...Object.keys(pkg.system.characterTemplate),...(pkg.system.dataDefinitions||[]).map(d=>d.binding.split('.')[0])]);
  const definition={id:uuid('data'),label:name.trim(),type,binding,required,nullable,...(hasInitial?{initial}: {})};
  const commands=[];if(!pkg.system.dataDefinitions)commands.push({type:'setProperty',path:['system','dataDefinitions'],value:[]});
  commands.push({type:'insertNode',path:['system','dataDefinitions'],index:pkg.system.dataDefinitions?.length||0,value:definition});
  return {commands,definition};
}
export function bindDataPlan(pkg,path,dataId) {
  const component=valueAt(pkg,path),definition=pkg.system.dataDefinitions?.find(d=>d.id===dataId);
  if(!definition || !BOUND_COMPONENT_TYPES[component.type]?.includes(definition.type))throw new Error('Escolha um dado compatível.');
  const commands=[{type:'setProperty',path:[...path,'dataId'],value:dataId}];
  for(const key of ['field','default'])if(Object.hasOwn(component,key))commands.push({type:'removeProperty',path:[...path,key]});
  return {commands};
}
export function ruleNode(op='literal',previous={}) {
  const operation=Object.hasOwn(RULE_OPERATIONS,op)?RULE_OPERATIONS[op]:null;if(!operation)throw new Error('Operação indisponível');
  const node={id:previous.id||uuid('node'),op,version:1,...(previous.extensions?{extensions:structuredClone(previous.extensions)}:{})};
  if(op==='literal')node.value=typeof previous.value==='number'?previous.value:0;
  else if(op==='read')node.dataId=previous.dataId||'';
  else for(const key of operation.inputs)node[key]=previous[key]&&typeof previous[key]==='object'?structuredClone(previous[key]):ruleNode();
  return node;
}
export function createTypedRulePlan(pkg,{name,expression}) {
  if(pkg.system.schemaVersion!==3 || !name?.trim())throw new Error('Informe nome do cálculo em pacote v3.');
  const rule={id:uuid('rule'),label:name.trim(),revision:1,kind:'calculation',resultType:'number',expression:structuredClone(expression)};
  const commands=[];if(!pkg.system.rules)commands.push({type:'setProperty',path:['system','rules'],value:[]});
  commands.push({type:'insertNode',path:['system','rules'],index:pkg.system.rules?.length||0,value:rule});
  return {commands,rule};
}
export function stepRecipe({dataId,step,absentFallback}) {
  if(typeof dataId!=='string' || !dataId || !Number.isFinite(step) || step<=0)throw new Error('Escolha um dado e um intervalo positivo.');
  let source={...ruleNode('read'),dataId};
  if(absentFallback!==undefined){if(!Number.isFinite(absentFallback))throw new Error('Alternativa deve ser número finito.');source={...ruleNode('ifAbsent'),value:source,fallback:{...ruleNode(),value:absentFallback}};}
  return {...ruleNode('floor'),value:{...ruleNode('divide'),left:source,right:{...ruleNode(),value:step}}};
}
