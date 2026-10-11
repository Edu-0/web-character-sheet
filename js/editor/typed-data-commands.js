import {generatedKey} from './data-index.js';
import {DATA_TYPES, BOUND_COMPONENT_TYPES,dataDefinition} from '../engine/data-definitions.js';
import {valueAt} from './form-structure.js';
import {RULE_OPERATIONS} from '../engine/rule-registry.js';
const uuid=prefix=>prefix+'-'+crypto.randomUUID();
export function createTypedDataPlan(pkg,{name,type='number',required=false,nullable=false,hasInitial=false,initial,fields=[],options=[],scale=[4,6,8,10,12],composite=false,target,multiple=false,...constraints}) {
  if(pkg.system.schemaVersion!==3 || pkg.schemaVersion!==3)throw new Error('Criação de dados tipados exige pacote v3. Abra um pacote novo; a abertura não converte documentos antigos.');
  if(!name?.trim() || !DATA_TYPES.includes(type))throw new Error('Informe nome e tipo do dado.');
  const binding=generatedKey(name,[...Object.keys(pkg.system.characterTemplate),...(pkg.system.dataDefinitions||[]).map(d=>d.binding.split('.')[0])]);
  const definition={id:uuid('data'),label:name.trim(),type,binding,required,nullable,...(hasInitial?{initial}: {})};
  Object.assign(definition,type==='record'||type==='collection'?{fields}:type==='enum'?{options}:type==='trait'?{scale,composite}:type==='reference'?{target,multiple}:{});
  for(const key of ['minimum','maximum','maxLength','minItems','maxItems','unique'])if(constraints[key]!==undefined)definition[key]=constraints[key];
  const commands=[];if(!pkg.system.dataDefinitions)commands.push({type:'setProperty',path:['system','dataDefinitions'],value:[]});
  commands.push({type:'insertNode',path:['system','dataDefinitions'],index:pkg.system.dataDefinitions?.length||0,value:definition});
  return {commands,definition};
}
export function bindDataPlan(pkg,path,dataId) {
  const component=valueAt(pkg,path);let definition;try{definition=dataDefinition(pkg.system,dataId);}catch{}
  if(!definition || !BOUND_COMPONENT_TYPES[component.type]?.includes(definition.type))throw new Error('Escolha um dado compatível.');
  const commands=[{type:'setProperty',path:[...path,'dataId'],value:dataId}];
  for(const key of ['field','default'])if(Object.hasOwn(component,key))commands.push({type:'removeProperty',path:[...path,key]});
  return {commands};
}
export function definitionPaths(pkg){
  const rows=[];const walk=(definitions,path)=>{for(const [index,definition]of (definitions||[]).entries()){const at=[...path,index];rows.push({definition,path:at});if(definition.fields)walk(definition.fields,[...at,'fields']);}};
  walk(pkg.system.dataDefinitions,['system','dataDefinitions']);for(const [index,catalog]of (pkg.system.catalogs||[]).entries())walk(catalog.fields,['system','catalogs',index,'fields']);return rows;
}
export function addTypedFieldPlan(pkg,parentId,settings){
  const parent=definitionPaths(pkg).find(r=>r.definition.id===parentId)||((pkg.system.catalogs||[]).map((definition,index)=>({definition,path:['system','catalogs',index]})).find(r=>r.definition.id===parentId));
  if(!parent || !Array.isArray(parent.definition.fields))throw new Error('Escolha registro, coleção ou catálogo');
  const plan=createTypedDataPlan(pkg,settings),definition=plan.definition;definition.binding=generatedKey(settings.name,['id',...parent.definition.fields.map(f=>f.binding)]);
  return {commands:[{type:'insertNode',path:[...parent.path,'fields'],index:parent.definition.fields.length,value:definition}],definition};
}
export function createCatalogPlan(pkg,name){
  if(pkg.system.schemaVersion!==3||!name?.trim())throw new Error('Informe nome de catálogo em v3');
  const catalog={id:uuid('catalog'),label:name.trim(),fields:[],entries:[]},commands=[];
  if(!pkg.system.catalogs)commands.push({type:'setProperty',path:['system','catalogs'],value:[]});
  commands.push({type:'insertNode',path:['system','catalogs'],index:pkg.system.catalogs?.length||0,value:catalog});return {commands,catalog};
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
