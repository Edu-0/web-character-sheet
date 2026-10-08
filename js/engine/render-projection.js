import {RESERVED_KEYS} from './paths.js';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
function changes(before,after,path=[],output=[]) {
  if(equal(before,after))return output;
  if(object(before)&&object(after))for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
    if(!path.length && key==='meta')continue;
    if(RESERVED_KEYS.has(key))throw new Error('Chave de projeção inválida.');
    const beforeExists=Object.hasOwn(before,key),afterExists=Object.hasOwn(after,key);
    if(beforeExists&&afterExists)changes(before[key],after[key],[...path,key],output);
    else output.push({path:[...path,key],exists:afterExists,value:after[key]});
  }else output.push({path,exists:true,value:after});
  return output;
}
const read=(root,path)=>{let value=root;for(const key of path){if(!value||typeof value!=='object'||!Object.hasOwn(value,key))return {exists:false};value=value[key];}return {exists:true,value};};
export function commitRenderedChanges(actual,original,before,after,validate=()=>{}) {
  const edits=changes(before,after),draft=structuredClone(actual);
  for(const edit of edits){
    if(!edit.path.length)throw new Error('A projeção não pode substituir a raiz.');
    const expected=read(original,edit.path),current=read(actual,edit.path);
    if(expected.exists!==current.exists || current.exists&&!equal(expected.value,current.value))throw new Error('Campo mudou durante a interação. Reabra o painel antes de confirmar.');
    let parent=draft;for(const key of edit.path.slice(0,-1)){if(!object(parent[key]))parent[key]={};parent=parent[key];}
    const key=edit.path.at(-1);if(edit.exists)parent[key]=structuredClone(edit.value);else delete parent[key];
  }
  validate(draft);
  for(const key of Object.keys(actual))if(!Object.hasOwn(draft,key))delete actual[key];Object.assign(actual,draft);
  return edits.length;
}
