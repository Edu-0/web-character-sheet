import {dataDefinition,readData} from './data-definitions.js';
import {referenceEntries,entryLabel} from './data-references.js';

// Reading projections only: labels and presence are shared by search and print.
export function formatTypedCell(system,character,definition,cell,context={}){
  if(!cell.present)return 'Ausente';
  if(cell.value===null)return 'null explícito';
  const value=cell.value;
  if(definition.type==='string')return value===''?'Texto vazio':value;
  if(definition.type==='boolean')return value?'Sim':'Não';
  if(definition.type==='enum')return definition.options.find(o=>o.id===value)?.label||value;
  if(definition.type==='trait')return value.map(n=>'d'+n).join(' + ');
  if(definition.type==='reference'){
    const entries=referenceEntries(system,character,definition,context);
    const fields=definition.target.scope==='system'?system.catalogs.find(c=>c.id===definition.target.catalogId).fields:dataDefinition(system,definition.target.dataId).fields;
    return (definition.multiple?value:[value]).map(id=>{const entry=entries.find(e=>e.id===id);return entry?entryLabel(entry,fields):'Referência indisponível: '+id;}).join(' · ')||'Nenhuma referência';
  }
  if(definition.type==='record')return definition.fields.map(field=>field.label+': '+formatTypedCell(system,character,field,Object.hasOwn(value,field.binding)?{present:true,value:value[field.binding]}:{present:false},context)).join(' · ')||'Registro vazio';
  if(definition.type==='collection')return value.map(entry=>entryLabel(entry,definition.fields)+': '+formatTypedCell(system,character,{...definition,type:'record'},{present:true,value:entry},{entries:[...(context.entries||[]),{dataId:definition.id,entryId:entry.id}]})).join('\n')||'Nenhum registro';
  return String(value);
}
export function typedComponentValue(context){return formatTypedCell(context.system,context.character,dataDefinition(context.system,context.dataId),readData(context.system,context.character,context.dataId,context.dataContext),context.dataContext);}

export function typedSearchRecords(context){
  const {system,character}=context,root=dataDefinition(system,context.dataId),records=[];
  const walk=(definition,cell,label,dataContext)=>{
    records.push({label,value:formatTypedCell(system,character,definition,cell,dataContext),dataId:definition.id,entryIds:structuredClone(dataContext.entries||[])});
    if(!cell.present||cell.value===null)return;
    if(definition.type==='record')for(const field of definition.fields)walk(field,Object.hasOwn(cell.value,field.binding)?{present:true,value:cell.value[field.binding]}:{present:false},label+' · '+field.label,dataContext);
    if(definition.type==='collection')for(const entry of cell.value){const next={entries:[...(dataContext.entries||[]),{dataId:definition.id,entryId:entry.id}]};for(const field of definition.fields)walk(field,Object.hasOwn(entry,field.binding)?{present:true,value:entry[field.binding]}:{present:false},label+' · '+entryLabel(entry,definition.fields)+' · '+field.label,next);}
  };walk(root,readData(system,character,root.id,context.dataContext),context.label||root.label,context.dataContext||{});return records;
}
