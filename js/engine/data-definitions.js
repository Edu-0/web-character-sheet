import {getByPath, pathKeys, setByPath} from './paths.js';

export const DATA_TYPES = Object.freeze(['string', 'number', 'integer', 'boolean']);
export const BOUND_COMPONENT_TYPES = Object.freeze({text:['string'], textarea:['string'], number:['number','integer'], boolean:['boolean']});
export function dataDefinition(system, id) {
  if (system?.schemaVersion !== 3) throw new Error('Vínculos tipados exigem sistema v3.');
  const definition = system.dataDefinitions?.find(d => d.id === id);
  if (!definition) throw new Error(`Dado inexistente: ${id}`);
  return definition;
}
export function valueIssue(definition, value) {
  if (value === null) return definition.nullable ? null : 'null não permitido';
  const valid = definition.type === 'integer' ? Number.isSafeInteger(value) : definition.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === definition.type;
  return valid ? null : `valor incompatível com ${definition.type}`;
}
export function readData(system, character, id) {
  const definition = dataDefinition(system, id), keys = pathKeys(definition.binding);
  let owner = character;
  for (const key of keys) {
    if(owner===undefined)return {present:false};
    if(owner===null || typeof owner!=='object' || Array.isArray(owner))throw new Error(`${definition.label}: binding atravessa valor não estruturado`);
    if(!Object.hasOwn(owner,key))return {present:false};
    owner = owner[key];
  }
  const issue = valueIssue(definition, owner);
  if (issue) throw new Error(`${definition.label}: ${issue}`);
  return {present:true, value:owner};
}
export function writeData(system, character, id, cell) {
  const definition = dataDefinition(system, id);
  let parent=character;for(const key of pathKeys(definition.binding).slice(0,-1)){if(parent===undefined)break;if(parent===null || typeof parent!=='object' || Array.isArray(parent))throw new Error('Binding atravessa valor não estruturado');parent=Object.hasOwn(parent,key)?parent[key]:undefined;}
  if(parent!==undefined && (parent===null || typeof parent!=='object' || Array.isArray(parent)))throw new Error('Binding atravessa valor não estruturado');
  if (!cell.present) {
    if (definition.required) throw new Error(`${definition.label}: dado obrigatório`);
    const keys = pathKeys(definition.binding), last = keys.pop();
    const owner = keys.length ? getByPath(character, keys.join('.')) : character;
    if (owner && typeof owner === 'object') delete owner[last];
    return;
  }
  const issue = valueIssue(definition, cell.value);
  if (issue) throw new Error(`${definition.label}: ${issue}`);
  setByPath(character, definition.binding, cell.value);
}
// Creation and a confirmed reset call this; mounting/importing/opening never initialize saved data.
export function initializeData(system, character) {
  if (system?.schemaVersion === 3) for (const definition of system.dataDefinitions || []) {
    if (!readData(system, character, definition.id).present && Object.hasOwn(definition, 'initial')) writeData(system, character, definition.id, {present:true, value:structuredClone(definition.initial)});
  }
  return character;
}
