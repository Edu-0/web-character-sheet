import {structuralNodes,valueAt} from './form-structure.js';
import {knownReferences} from './references.js';
import {pointerPath} from './form-commands.js';
// Only consumers that actually parse dice expressions authorize this builder.
export function diceLiteralAt(pkg,path){if(path[0]!=='system'||path[1]!=='characterTemplate')return false;const relative=path.slice(2),field=relative.join('.'),nodes=structuralNodes(pkg);
 const inCollection=(collection,itemField)=>{if(typeof collection!=='string')return false;const prefix=collection.split('.');return prefix.every((key,i)=>relative[i]===key)&&typeof relative[prefix.length]==='number'&&relative.slice(prefix.length+1).join('.')===itemField;};
 for(const ref of knownReferences(pkg)){
  const p=pointerPath(pkg,ref.pointer),owner=valueAt(pkg,p.slice(0,-1));
  if(p[0]==='system'&&p.some((_,i)=>valueAt(pkg,p.slice(0,i))?.algorithm==='explodingDamage')){
   if(ref.kind==='field'&&ref.value===field)return true;
   if(ref.kind==='collection'&&inCollection(ref.value,owner.valueField))return true;
  }
  if(ref.kind==='field'&&ref.value===field&&p.some(k=>['expression','increment'].includes(k)))return true;
  if(ref.kind==='itemField'&&p[1]==='entryRolls'&&p.some(k=>['expression','increment'].includes(k))&&nodes.some(n=>(n.value?.rollPreset??n.value?.rollConfigFrom)===p[2]&&inCollection(n.value.field,ref.value)))return true;
 }
 return false;
}
