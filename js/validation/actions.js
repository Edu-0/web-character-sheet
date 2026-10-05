import {getByPath,pathKeys} from '../engine/paths.js';
export const ACTION_OPERATIONS=['set','add','restoreResource','rollResource','reduceNamedStates','clearNamedStates','restoreCollection','setCollection'];
export function validateActions(actions,system,issues,root='system.sheetActions',character=system.characterTemplate) {
  const add=(path,message)=>issues.push({path,message,code:'action.invalid'});
  const path=(value,at)=>{try{pathKeys(value);}catch(error){add(at,error.message);}};
  const read=value=>{try{return getByPath(character,value);}catch{return undefined;}};
  if(!Array.isArray(actions) || actions.length>100){add(root,'use até 100 ações');return;}
  const ids=new Set();
  actions.forEach((action,index)=>{
    const at=`${root}[${index}]`;
    if(!action || typeof action!=='object'){add(at,'deve ser objeto');return;}
    if(typeof action.id!=='string'||!action.id||ids.has(action.id))add(`${at}.id`,'ID textual único obrigatório');ids.add(action.id);
    const requirements=action.requirements || [];
    if(!Array.isArray(requirements)){add(`${at}.requirements`,'deve ser lista');return;}
    requirements.forEach((r,i)=>{
      const loc=`${at}.requirements[${i}]`;if(!r || typeof r!=='object'){add(loc,'deve ser objeto');return;}
      path(r.field,`${loc}.field`);
      if(r.min!==undefined && !Number.isFinite(r.min))add(`${loc}.min`,'deve ser número finito');
      if(r.min===undefined && r.equals===undefined)add(loc,'informe min ou equals');
    });
    const operations=action.effects || action.operations || [];
    if(!Array.isArray(operations)){add(`${at}.operations`,'deve ser lista');return;}
    operations.forEach((op,i)=>{
      const loc=`${at}.operations[${i}]`;if(!op || typeof op!=='object'){add(loc,'deve ser objeto');return;}
      if(!ACTION_OPERATIONS.includes(op.type))add(`${loc}.type`,'operação desconhecida');
      path(op.field,`${loc}.field`);
      if(op.type==='add'){
        if(!Number.isFinite(op.amount))add(`${loc}.amount`,'deve ser número finito');
        const value=read(op.field);if(value!=null && !Number.isFinite(value))add(`character.${op.field}`,'deve ser número finito');
      }
      if(['restoreResource','rollResource'].includes(op.type)){
        const resource=read(op.field);
        if(resource!=null && (!resource || typeof resource!=='object' || ['current','max'].some(key=>resource[key]!==undefined && !Number.isFinite(resource[key]))))add(`character.${op.field}`,'recurso atual/máximo inválido');
      }
      if(op.type==='rollResource'){path(op.sourceField,`${loc}.sourceField`);path(op.dieField,`${loc}.dieField`);}
      if(['reduceNamedStates','clearNamedStates'].includes(op.type)){
        if(!Array.isArray(op.names) && typeof op.name!=='string')add(`${loc}.names`,'informe os nomes de estados');
        if(op.steps!==undefined && (!Number.isInteger(op.steps)||op.steps<1))add(`${loc}.steps`,'deve ser inteiro positivo');
      }
    });
  });
}
