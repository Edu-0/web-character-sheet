import {cachedProjection} from './projection-cache.js';
import {pointerFor} from './source-map.js';
const referenceKeys=new Set(['field','formula','optionsFrom','presetsFrom','traitsFrom','configFrom','actionsFrom','rollPreset','rollConfigFrom','collection','overrideKey','definitionId','sourceId','check','historyField','costsFrom','labelsFrom','catalogFrom','progressionFrom','formulaFrom','attributesFrom','categoriesFrom','baseDieFrom','sidesFrom']);
// A report of consumed reference slots, never a string-replacement/refactor graph.
export function knownReferences(pkg) {return cachedProjection(pkg,'references',()=>buildKnownReferences(pkg));}
function buildKnownReferences(pkg) {
  if(!pkg?.system || !Array.isArray(pkg.layouts))return [];
  const result=[{pointer:'/system/id',kind:'identity',value:pkg.system.id},{pointer:'/system/characterTemplate/meta/system',kind:'system',value:pkg.system.characterTemplate?.meta?.system}];
  const walk=(value,path)=>{
    if(!value||typeof value!=='object')return;
    for(const [key,child]of Object.entries(value)){
      const next=[...path,key];
      if(typeof child==='string' && key==='difficultyFormula')result.push({pointer:pointerFor(next),kind:'formula',value:child});
      if(typeof child==='string' && key==='key' && path.at(-1)==='target' && value.kind==='checkModifier')result.push({pointer:pointerFor(next),kind:'checkTarget',value:child});
      if(typeof child==='string' && (referenceKeys.has(key)||key.endsWith('Field')||key==='source'&&path.at(-1)==='repeat'||key==='system'&&path.at(-2)==='variables'||path.at(-1)==='overrideKeys'))result.push({pointer:pointerFor(next),kind:key,value:child});
      // Opaque extension metadata and text are deliberately outside this report.
      if(child&&typeof child==='object' && !['metadata','extra','extras','manifest','extensions'].includes(key))walk(child,next);
    }
  };
  pkg.layouts.forEach((layout,index)=>{result.push({pointer:`/layouts/${index}/system`,kind:'system',value:layout?.system});walk(layout,['layouts',index]);});
  // Expressões são relatadas como unidades; não presumir refatoração de tokens.
  if(pkg.system.formulas && typeof pkg.system.formulas==='object' && !Array.isArray(pkg.system.formulas))for(const [key,value]of Object.entries(pkg.system.formulas))if(typeof value==='string')result.push({pointer:pointerFor(['system','formulas',key]),kind:'expression',value});
  walk(pkg.system.characterTemplate?.activeEffects,['system','characterTemplate','activeEffects']);
  const consumed=result.filter(ref=>['configFrom','actionsFrom','rollConfigFrom'].includes(ref.kind));const followed=new Set();for(const ref of consumed){const parts=ref.value.replace(/^system\./,'').split('.'),pointer=pointerFor(['system',...parts]);if(followed.has(pointer)||['checks','entryRolls','recoveryActions','sheetActions','effectDefinitions','pointBudget','repertoire','techniqueUse','resolution'].includes(parts[0]))continue;followed.add(pointer);let value=pkg.system;for(const part of parts)value=value!=null&&Object.hasOwn(Object(value),part)?value[part]:undefined;if(value&&typeof value==='object')walk(value,['system',...parts]);}
  for(const key of ['checks','entryRolls','recoveryActions','sheetActions','effectDefinitions','pointBudget','repertoire','techniqueUse','resolution'])walk(pkg.system[key],['system',key]);
  return result;
}
export function identityImpact(base,candidate) {
  if(!base)return {created:true,removedLayouts:[],changedReferences:[]};
  const previous=knownReferences(base),next=new Map(knownReferences(candidate).map(entry=>[entry.pointer,entry]));
  return {created:base.system?.id!==candidate.system.id,removedLayouts:(Array.isArray(base.layouts)?base.layouts:[]).filter(layout=>layout?.id && !candidate.layouts.some(item=>item.id===layout.id)).map(layout=>layout.id),changedReferences:previous.filter(entry=>next.get(entry.pointer)?.value!==entry.value)};
}
