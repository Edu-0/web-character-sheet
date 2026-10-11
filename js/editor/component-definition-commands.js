import {valueAt} from './form-structure.js';
import {dataDefinition} from '../engine/data-definitions.js';
const uuid=prefix=>prefix+'-'+crypto.randomUUID();
const replaceNode=(path,value)=>[{type:'removeNode',path:path.slice(0,-1),index:path.at(-1)},{type:'insertNode',path:path.slice(0,-1),index:path.at(-1),value}];
const mapComponents=(components,transform)=>components.map(component=>{const copy=transform(structuredClone(component));if(copy.type==='group')copy.components=mapComponents(copy.components||[],transform);return copy;});

export function createComponentDefinitionPlan(pkg,path,name){
  const group=valueAt(pkg,path);if(pkg.system.schemaVersion!==3||group?.type!=='group'||!name?.trim())throw new Error('Selecione grupo e nomeie o composto');
  const parameters=[],bindings={},byData=new Map();
  const components=mapComponents(group.components,component=>{
    if(component.dataId){let parameter=byData.get(component.dataId);if(!parameter){const data=dataDefinition(pkg.system,component.dataId);parameter={id:uuid('parameter'),label:data.label,type:data.type};parameters.push(parameter);bindings[parameter.id]=data.id;byData.set(data.id,parameter);}delete component.dataId;component.dataParameter=parameter.id;}
    return component;
  });
  const definition={id:uuid('component'),label:name.trim(),revision:1,parameters,components,...(group.layout?{layout:structuredClone(group.layout)}:{})},commands=[];
  if(!pkg.system.componentDefinitions)commands.push({type:'setProperty',path:['system','componentDefinitions'],value:[]});
  const {type,components:children,layout,...presentation}=structuredClone(group);
  commands.push({type:'insertNode',path:['system','componentDefinitions'],index:pkg.system.componentDefinitions?.length||0,value:definition},...replaceNode(path,{...presentation,type:'componentInstance',definitionId:definition.id,bindings}));
  return {commands,definition,selection:path};
}
export function detachComponentPlan(pkg,path){
  const instance=valueAt(pkg,path),definition=pkg.system.componentDefinitions?.find(d=>d.id===instance?.definitionId);if(instance?.type!=='componentInstance'||!definition)throw new Error('Selecione instância de composto local');
  const components=mapComponents(definition.components,c=>{if(c.dataParameter){c.dataId=instance.bindings[c.dataParameter];delete c.dataParameter;}return c;});
  const {type,definitionId,bindings,...presentation}=structuredClone(instance);
  return {commands:replaceNode(path,{...presentation,type:'group',label:instance.label||definition.label,layout:structuredClone(definition.layout||{type:'stack'}),components}),selection:path};
}
export function copyComponentDefinitionPlan(pkg,id){
  const index=pkg.system.componentDefinitions?.findIndex(d=>d.id===id);if(index===undefined||index<0)throw new Error('Composto inexistente');
  const definition=structuredClone(pkg.system.componentDefinitions[index]),ids=new Map();definition.id=uuid('component');definition.label+=' (cópia)';definition.revision=1;
  for(const parameter of definition.parameters){const previous=parameter.id;parameter.id=uuid('parameter');ids.set(previous,parameter.id);}
  definition.components=mapComponents(definition.components,c=>{if(c.dataParameter)c.dataParameter=ids.get(c.dataParameter);return c;});
  return {commands:[{type:'insertNode',path:['system','componentDefinitions'],index:pkg.system.componentDefinitions.length,value:definition}],definition};
}
