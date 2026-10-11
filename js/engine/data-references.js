import {dataDefinition,readData} from './data-definitions.js';

export function referenceEntries(system,character,definition,context={}) {
  const target=definition.target;
  if(target?.scope==='system') {
    const catalog=system.catalogs?.find(c=>c.id===target.catalogId);
    if(!catalog)throw new Error(`${definition.label}: catálogo inexistente`);
    return catalog.entries||[];
  }
  if(target?.scope==='character') {
    const collection=dataDefinition(system,target.dataId);
    if(collection.type!=='collection')throw new Error('Destino de referência não é coleção');
    const cell=readData(system,character,target.dataId,context);
    return cell.present&&cell.value!==null?cell.value:[];
  }
  throw new Error('Destino de referência não configurado');
}
export function referenceValueIssue(system,character,definition,value,context={}) {
  if(value===null)return null;
  try{const entries=referenceEntries(system,character,definition,context),ids=definition.multiple?value:[value];
    for(const id of ids){const matches=entries.filter(e=>e.id===id);if(matches.length!==1)return `${definition.label}: referência ${id} ausente ou ambígua`;}
  }catch(error){return error.message;}
  return null;
}
export function entryLabel(entry,fields=[]) {
  const name=fields.find(f=>f.type==='string');return name&&entry[name.binding]!==undefined?String(entry[name.binding]):entry.id;
}
