import {dataDefinition,readData} from './data-definitions.js';
import {projectTypedTarget} from './typed-effect-runtime.js';
import {formatTypedCell} from './typed-value-format.js';

// A read-only projection beside the existing editable base control. Refresh
// never records a game event or writes a character value.
export function mountEffectiveData(host,context){
 const {system,character,dataId,dataContext={},label,registerRefresh,ruleEvaluation}=context;
 if(!(system.effectDefinitions||[]).some(d=>d.profile==='typed'&&d.operations.some(op=>op.target.kind==='data'&&op.target.dataId===dataId)))return;
 const output=document.createElement('output');output.className='engine-effective-value';output.setAttribute('aria-label','Valor efetivo de '+label);host.append(output);
 const refresh=()=>{try{const definition=dataDefinition(system,dataId),base=readData(system,character,dataId,dataContext),result=ruleEvaluation?.project?ruleEvaluation.project({kind:'data',dataId},base):projectTypedTarget(system,character,{kind:'data',dataId},base);output.textContent='Efetivo: '+formatTypedCell(system,character,definition,result.cell,dataContext)+(result.trace.length?' · '+result.trace.map(row=>row.label).join(', '):'')+(result.suppressed.length?' · '+result.suppressed.map(row=>row.label+': '+row.reason).join('; '):'');}catch(error){output.textContent='Projeção indisponível: '+error.message;}};
 refresh();registerRefresh?.(refresh);return output;
}
