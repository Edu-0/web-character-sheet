import { RESERVED_KEYS, inspectPlaceholder } from './operation-paths.js';
import { validateText } from './validation.js';

const clone = value => structuredClone(value);
function jsonValue(value,seen=new Set()) {
  if(value===null || typeof value==='string' || typeof value==='boolean')return;
  if(typeof value==='number' && Number.isFinite(value) && !Object.is(value,-0))return;
  if(!value || typeof value!=='object' || seen.has(value) || !Array.isArray(value) && Object.getPrototypeOf(value)!==Object.prototype && Object.getPrototypeOf(value)!==null)throw new Error('Valor não representável em JSON.');
  seen.add(value);
  if(Object.getOwnPropertySymbols(value).length || Array.isArray(value) && (Object.keys(value).length!==value.length || Object.keys(value).some(key=>!/^\d+$/.test(key) || Number(key)>=value.length)))throw new Error('Valor não representável em JSON.');
  for(const key of Object.keys(value)){if(RESERVED_KEYS.has(key))throw new Error('Chave reservada.');jsonValue(value[key],seen);}
  seen.delete(value);
}
function target(root, path) {
  inspectPlaceholder(path);
  let value=root;
  for (const key of path) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value,key)) throw new Error('Alvo ausente; operação cancelada.');
    value=value[key];
  }
  return value;
}
function property(root,path) {
  if (!path.length) throw new Error('Use replaceText para substituir a raiz.');
  const parent=target(root,path.slice(0,-1)), key=path.at(-1);
  if (!parent || typeof parent!=='object') throw new Error('Alvo não é objeto.');
  return {parent,key};
}
export function applyOperations(text, commands) {
  const parsed=validateText(text);
  if (!parsed.value || parsed.diagnostics.some(issue=>issue.code?.startsWith('json.'))) throw new Error('Corrija sintaxe/duplicatas/números antes de operações estruturadas.');
  const document=clone(parsed.value);
  for (const command of commands) {
    inspectPlaceholder(command.path);
    if (command.precondition) {
      const {parent,key}=property(document,command.path), exists=Object.hasOwn(parent,key);
      if (exists!==command.precondition.exists || exists && JSON.stringify(parent[key])!==JSON.stringify(command.precondition.value)) throw new Error('Precondição divergente.');
    }
    if (command.type==='setProperty' || command.type==='removeProperty') {
      const {parent,key}=property(document,command.path);
      if (Array.isArray(parent)) throw new Error('Use operações de nós para arrays.');
      if (command.type==='removeProperty') delete parent[key];
      else { jsonValue(command.value); parent[key]=clone(command.value); }
    } else {
      const array=target(document,command.path);
      if (!Array.isArray(array)) throw new Error('Destino não é array.');
      const check = (index,insert=false) => { if (!Number.isInteger(index) || index<0 || index>array.length-(insert?0:1)) throw new Error('Índice inválido.'); };
      if (command.type==='insertNode') {check(command.index,true);jsonValue(command.value); array.splice(command.index,0,clone(command.value));}
      else if (command.type==='removeNode') {check(command.index); array.splice(command.index,1);}
      else if (command.type==='duplicateNode') {check(command.index); check(command.to,true); array.splice(command.to,0,clone(array[command.index]));}
      else if (command.type==='moveNode') {check(command.index);const toPath=command.toPath || command.path,source=[...command.path,command.index];if(toPath.length>=source.length && source.every((part,i)=>String(part)===String(toPath[i])))throw new Error('Não é possível mover um nó para seu descendente.'); const destination=target(document,toPath); if (!Array.isArray(destination) || !Number.isInteger(command.to) || command.to<0 || command.to>destination.length-(destination===array?1:0)) throw new Error('Destino inválido.'); const item=array.splice(command.index,1)[0]; destination.splice(command.to,0,item);}
      else throw new Error('Comando desconhecido.');
    }
  }
  const output=JSON.stringify(document,null,2), result=validateText(output);
  if (result.diagnostics.some(issue=>issue.code?.startsWith('json.'))) throw new Error('Operação excedeu limites ou perderia dados.');
  return output;
}
