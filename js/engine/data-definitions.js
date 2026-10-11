import {getByPath, pathKeys, setByPath} from './paths.js';
import {DATA_TYPES, typedValueIssue, initializeStructuredValue} from './data-types.js';
export {DATA_TYPES} from './data-types.js';

export const BOUND_COMPONENT_TYPES = Object.freeze({text:['string'], textarea:['string'], number:['number','integer'], boolean:['boolean'],dataField:DATA_TYPES});
export function dataDefinitions(system) {
  const rows=[];
  const walk=(definitions,ancestors=[],depth=0,path=[])=>{if(depth>8)throw new Error('Profundidade de dados excedida');for(const [index,definition]of (definitions||[]).entries()){const at=[...path,index];rows.push({definition,ancestors,path:at});if(definition.fields)walk(definition.fields,[...ancestors,definition],depth+1,[...at,'fields']);}};
  walk(system?.schemaVersion===3?system.dataDefinitions:[]);return rows;
}
export function dataDefinition(system, id) {
  if (system?.schemaVersion !== 3) throw new Error('Vínculos tipados exigem sistema v3.');
  const definition = dataDefinitions(system).find(d => d.definition.id === id)?.definition;
  if (!definition) throw new Error(`Dado inexistente: ${id}`);
  return definition;
}
export function valueIssue(definition, value) {
  return typedValueIssue(definition,value);
}
export function dataPath(system,character,id,context={}) {
  const row=dataDefinitions(system).find(d=>d.definition.id===id);if(!row)throw new Error(`Dado inexistente: ${id}`);
  const keys=[];
  for(const definition of [...row.ancestors,row.definition]){
    keys.push(...pathKeys(definition.binding));
    if(definition.type==='collection' && definition!==row.definition){
      const collection=getByPath(character,keys.join('.')),entryId=context.entries?.find(e=>e.dataId===definition.id)?.entryId;
      const index=Array.isArray(collection)?collection.findIndex(e=>e.id===entryId):-1;
      if(index<0)throw new Error(`${definition.label}: entrada inexistente no contexto`);keys.push(String(index));
    }
  }
  return keys.join('.');
}
export function readData(system, character, id, context={}) {
  const definition = dataDefinition(system, id), keys = pathKeys(dataPath(system,character,id,context));
  let owner = character;
  for (const key of keys) {
    if(owner===undefined)return {present:false};
    if(owner===null || typeof owner!=='object' || Array.isArray(owner)&&!/^\d+$/.test(key))throw new Error(`${definition.label}: binding atravessa valor não estruturado`);
    if(!Object.hasOwn(owner,key))return {present:false};
    owner = owner[key];
  }
  const issue = valueIssue(definition, owner);
  if (issue) throw new Error(`${definition.label}: ${issue}`);
  return {present:true, value:owner};
}
export function writeData(system, character, id, cell, context={}) {
  const definition = dataDefinition(system, id);
  const binding=dataPath(system,character,id,context);
  let parent=character;for(const key of pathKeys(binding).slice(0,-1)){if(parent===undefined)break;if(parent===null || typeof parent!=='object' || Array.isArray(parent)&&!/^\d+$/.test(key))throw new Error('Binding atravessa valor não estruturado');parent=Object.hasOwn(parent,key)?parent[key]:undefined;}
  if(parent!==undefined && (parent===null || typeof parent!=='object' || Array.isArray(parent)))throw new Error('Binding atravessa valor não estruturado');
  if (!cell.present) {
    if (definition.required) throw new Error(`${definition.label}: dado obrigatório`);
    const keys = pathKeys(binding), last = keys.pop();
    const owner = keys.length ? getByPath(character, keys.join('.')) : character;
    if (owner && typeof owner === 'object') delete owner[last];
    return;
  }
  const issue = valueIssue(definition, cell.value);
  if (issue) throw new Error(`${definition.label}: ${issue}`);
  setByPath(character, binding, cell.value);
}
// Creation and a confirmed reset call this; mounting/importing/opening never initialize saved data.
export function initializeData(system, character) {
  if (system?.schemaVersion === 3) for (const definition of system.dataDefinitions || []) {
    const current=getByPath(character,definition.binding);
    if(current===undefined && Object.hasOwn(definition,'initial'))writeData(system,character,definition.id,{present:true,value:initializeStructuredValue(definition,structuredClone(definition.initial))});
    else if(current!==undefined){const initialized=initializeStructuredValue(definition,structuredClone(current));const issue=valueIssue(definition,initialized);if(issue)throw new Error(issue);setByPath(character,definition.binding,initialized);}
  }
  return character;
}
