import {resolutionResultDefinition} from '../../js/engine/resolution-results.js';

export function transformed(original,variant){
 const ids=new Map(),bindings=new Map();let serial=0;
 const walk=value=>{if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object'){if(value.id&&!ids.has(value.id))ids.set(value.id,'sample_'+variant+'_'+(++serial));if(value.binding&&!bindings.has(value.binding))bindings.set(value.binding,'storage_'+variant+'_'+bindings.size);Object.values(value).forEach(walk);}};walk(original);
 const ports=(a,b)=>{ids.set(a.id,b.id);for(let i=0;i<(a.fields||[]).length;i++)ports(a.fields[i],b.fields[i]);};
 for(const action of original.system.sheetActions||[])for(const step of action.flow?.steps||[])if(step.type==='resolve')ports(resolutionResultDefinition(step),resolutionResultDefinition({...step,id:ids.get(step.id)}));
 const rewrite=(value,key)=>Array.isArray(value)?value.map(v=>rewrite(v)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[ids.get(key)||bindings.get(key)||key,rewrite(v,key)])):typeof value==='string'?ids.get(value)||bindings.get(value)||(key==='field'&&value.includes('.')?value.split('.').map(part=>bindings.get(part)||part).join('.'):null)||(['label','name'].includes(key)?'Nome '+variant+' '+(++serial):value):value;
 return {pkg:rewrite(original),ids,bindings};
}
