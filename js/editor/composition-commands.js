import {COMPONENT_CONTRACTS} from '../validation/contracts.js';
import {valueAt,object,destinations,structuralNodes,structureCommand} from './form-structure.js';
import {generatedKey,compatibleData,dataIndex} from './data-index.js';
import {pointerFor} from './source-map.js';
export function namedDestinations(pkg,kind){const nodes=structuralNodes(pkg);return destinations(pkg,kind).map(destination=>({...destination,title:nodes.filter(n=>!['package','system'].includes(n.kind)&&n.path.length<destination.path.length&&n.path.every((part,i)=>part===destination.path[i])).map(n=>n.title).join(' › ')}));}
export function insertionPlan(pkg,{type,name,destination,existingField,initial,hasInitial=false,formula,existingFormula,prototype,variables={},overrideKey,options=[]}){
 if(!COMPONENT_CONTRACTS[type])throw new Error('Componente desconhecido.');
 if(!destinations(pkg,'component').some(d=>pointerFor(d.path)===pointerFor(destination)))throw new Error('Escolha um grupo da ficha.');
 const array=valueAt(pkg,destination);if(!Array.isArray(array))throw new Error('O grupo precisa de reparo explícito antes de receber componentes.');
 if(prototype){if(prototype.type!==type)throw new Error('Exemplo incompatível.');return {commands:[{type:'insertNode',path:destination,index:array.length,value:{...structuredClone(prototype),label:name||prototype.label}}],selection:[...destination,array.length],dependencies:['Reutiliza os mesmos dados e regras do exemplo.']};}
 const component={type,label:name||COMPONENT_CONTRACTS[type].summary},commands=[],dependencies=[];
 if(COMPONENT_CONTRACTS[type].properties.field?.required){
  let field=existingField;
  if(field){if(!compatibleData(pkg,type).some(d=>d.field===field))throw new Error('Dado incompatível com este componente.');}
  else {field=generatedKey(name,[...Object.keys(pkg.system.characterTemplate),...dataIndex(pkg).filter(row=>row.scope==='character').map(row=>row.field.split('.')[0])]);let value;
   if(type==='resource'){if(!hasInitial||!object(initial)||!Number.isFinite(initial.current)||!Number.isFinite(initial.max))throw new Error('Informe valor atual e máximo do recurso.');value=initial;}
   else if(['list','table','stateList','tagList','slotTracker'].includes(type))value=[];
   else if(hasInitial)value=initial;
   if(value!==undefined)commands.push({type:'setProperty',path:['system','characterTemplate',field],value});dependencies.push('Dado: '+component.label+(value===undefined?' (sem valor inicial)':''));
  }
  component.field=field;
 }
 if(type==='select'){if(!options.length)throw new Error('Adicione pelo menos uma opção.');component.options=options;}
 if(['list','table'].includes(type)){const schemas=existingField?structuralNodes(pkg).filter(n=>n.kind==='component'&&n.value?.field===existingField&&n.value?.itemSchema).map(n=>n.value.itemSchema):[];if(new Set(schemas.map(s=>JSON.stringify(s))).size>1)throw new Error('Esta coleção tem apresentações com campos diferentes. Reutilize explicitamente o exemplo desejado.');component.itemSchema=schemas.length?structuredClone(schemas[0]):{name:{type:'text',label:'Nome'}};}
 if(type==='computed'&&existingFormula){if(!Object.hasOwn(pkg.system.formulas||{},existingFormula))throw new Error('Cálculo inexistente.');component.formula=existingFormula;}
 if(type==='computed'&&!existingFormula){
  if(!formula)throw new Error('Monte o cálculo antes de incluir.');const key=generatedKey(name,Object.keys(pkg.system.formulas||{}));
  if(!Object.hasOwn(pkg.system,'formulas'))commands.push({type:'setProperty',path:['system','formulas'],value:{}});
  commands.push({type:'setProperty',path:['system','formulas',key],value:formula});component.formula=key;if(Object.keys(variables).length)component.variables=variables;dependencies.push('Cálculo: '+component.label);
 }
 if(type==='computed'){if(Object.keys(variables).length)component.variables=structuredClone(variables);if(overrideKey)component.overrideKey=overrideKey;}
 for(const [key,desc]of Object.entries(COMPONENT_CONTRACTS[type].properties))if(desc.required&&!Object.hasOwn(component,key))throw new Error('Este módulo precisa de uma receita ou regra compartilhada antes da inclusão.');
 commands.push({type:'insertNode',path:destination,index:array.length,value:component});
 return {commands,selection:[...destination,array.length],dependencies,component};
}
export function movePlan(pkg,node,destination,to){
 const sourceParent=valueAt(pkg,node.path.slice(0,-2)),targetParent=valueAt(pkg,destination.slice(0,-1));
 if(node.kind==='component'&&JSON.stringify(sourceParent?.repeat)!==JSON.stringify(targetParent?.repeat)&&/\{[^}]+\}/.test(JSON.stringify(node.value)))throw new Error('Este bloco usa entradas da repetição. Mova o grupo inteiro ou escolha vínculos comuns antes de movê-lo.');
 return structureCommand(pkg,node,'move',{destination,to});
}
export function moveChoices(pkg,node,destination){const array=valueAt(pkg,destination);if(!Array.isArray(array))return [];const same=pointerFor(node.path.slice(0,-1))===pointerFor(destination),items=array.filter((_,i)=>!same||i!==node.path.at(-1));return Array.from({length:items.length+1},(_,i)=>({to:i,label:i===0?'No início':i===items.length?'No fim':'Antes de '+(items[i]?.label||items[i]?.title||items[i]?.name||items[i]?.type||'bloco '+(i+1))}));}
