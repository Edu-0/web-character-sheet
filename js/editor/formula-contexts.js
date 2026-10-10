import {knownReferences} from './references.js';
import {pointerPath} from './form-commands.js';
import {valueAt} from './form-structure.js';
import {computedKey} from '../engine/computed-values.js';
export function formulaContexts(pkg,name,{family='computed'}={}){
 const distinct=new Map(),unsupported=family==='roll'?['system','traitMaxField','rollField']:['itemField','resolver','formula',...(family==='check'?['rollField']:[])];
 for(const ref of knownReferences(pkg))if(ref.kind==='formula'&&ref.value===name){
  const path=pointerPath(pkg,ref.pointer),owner=valueAt(pkg,path.slice(0,-1)),computed=owner?.type==='computed'||path.some((_,i)=>valueAt(pkg,path.slice(0,i))?.algorithm);
  if(family!=='roll'&&!computed||family==='check'&&owner?.mode==='roll')continue;
  const variables=owner?.variables||{};
  if(Object.values(variables).some(v=>v&&typeof v==='object'&&unsupported.some(k=>Object.hasOwn(v,k))))continue;
  // Computed/check keys are suffixes; rollValue consumes the complete literal key.
  const overrideKey=family==='roll'&&computed?owner.override===false?undefined:computedKey(owner):owner?.overrideKey;
  const signature=JSON.stringify([variables,overrideKey]);
  if(!distinct.has(signature))distinct.set(signature,{pointer:ref.pointer,label:owner?.label||'Uso do cálculo '+name,variables,...(overrideKey?{overrideKey}:{})});
 }
 return [...distinct.values()];
}
