import {prepareDocument} from '../validation/documents.js';
import {inspectJson,LIMITS} from '../validation/limits.js';
import {dataDefinitions,dataPath} from '../engine/data-definitions.js';
import {pathKeys,setByPath} from '../engine/paths.js';
import {readCharacterCell,changesBetween} from '../engine/character-history.js';
import {convertDataCells,validateConversion} from './data-conversions.js';
import {systemDataRevision} from '../engine/data-revision.js';

export const MIGRATION_LIMITS=Object.freeze({steps:500,characters:10000,values:100000,samples:10,bytes:LIMITS.backupBytes});
const clone=value=>structuredClone(value),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function keys(value,allowed,label){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error(label+': estrutura ou parâmetro não permitido.');}
function ready(document,kind,pkg){const result=prepareDocument(document,{kind,pkg});if(result.status!=='ready')throw Error(result.diagnostics.map(issue=>issue.path+': '+issue.message).join('; ')||'Documento não disponível para migração.');return result.document;}
const address=row=>row.ancestors.map(parent=>[parent.id,parent.binding,parent.type]).concat([[row.definition.id,row.definition.binding,row.definition.type]]);
function shape(definition){return Object.fromEntries(Object.entries(definition).filter(([key])=>!['label','description','initial','extensions','fields'].includes(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,key==='options'?value.map(option=>option.id).sort():value]));}
export function dataMigrationImpact(base,candidate){
 const before=dataDefinitions(base.system),after=dataDefinitions(candidate.system),rows=[];
 for(const old of before){const next=after.find(row=>row.definition.id===old.definition.id);if(!next)rows.push({kind:'retired',dataId:old.definition.id,label:old.definition.label,before:clone(old.definition)});else if(!equal(shape(old.definition),shape(next.definition))||!equal(address(old),address(next)))rows.push({kind:'changed',dataId:old.definition.id,label:next.definition.label,before:clone(old.definition),after:clone(next.definition)});}
 for(const row of after)if(!before.some(old=>old.definition.id===row.definition.id))rows.push({kind:'added',dataId:row.definition.id,label:row.definition.label,after:clone(row.definition)});
 return rows;
}
function contexts(row,system,character){
 let list=[{entries:[]}];
 for(const parent of row.ancestors.filter(parent=>parent.type==='collection'))list=list.flatMap(context=>{
  const cell=readCharacterCell(character,pathKeys(dataPath(system,character,parent.id,context)));if(!cell.exists||cell.value===null)return [];if(!Array.isArray(cell.value))throw Error('Coleção de origem inválida.');return cell.value.map(entry=>({entries:[...context.entries,{dataId:parent.id,entryId:entry.id}]}));
 });return list;
}
const collectionIds=row=>row.ancestors.filter(parent=>parent.type==='collection').map(parent=>parent.id);
function targetContext(row,sourceContext){const ids=collectionIds(row);if(ids.length!==sourceContext.entries.length)throw Error('Destino exige o mesmo número de coleções da origem.');return {entries:ids.map((dataId,index)=>({dataId,entryId:sourceContext.entries[index].entryId}))};}
function rawCell(character,path){const cell=readCharacterCell(character,path);return cell.exists?{present:true,value:clone(cell.value)}:{present:false};}
function putCell(character,path,cell){
 if(!cell.present&&!readCharacterCell(character,path).exists)return;
 let owner=character;for(const key of path.slice(0,-1)){if(!Object.hasOwn(owner,key))break;owner=owner[key];if(owner===null||typeof owner!=='object')throw Error('Destino atravessa um valor existente não estruturado.');}
 if(cell.present)setByPath(character,path.join('.'),clone(cell.value));
 else{const parent=readCharacterCell(character,path.slice(0,-1));if(parent.exists&&object(parent.value))delete parent.value[path.at(-1)];}
}
const prefix=(a,b)=>a.length<=b.length&&a.every((key,index)=>key===b[index]);
function validateSpec(spec,before,after,ids){
 keys(spec,['version','steps','retired','overrides','replaceRevisionMetadata'],'Plano');if(spec.version!==1||!Array.isArray(spec.steps)||spec.steps.length>MIGRATION_LIMITS.steps||!Array.isArray(spec.retired??[])||!Array.isArray(spec.overrides??[])||spec.replaceRevisionMetadata!==undefined&&typeof spec.replaceRevisionMetadata!=='boolean')throw Error('Plano de migração v1 com listas limitadas exigido.');
 const safety=inspectJson(spec,'migration');if(safety.length)throw Error(safety[0].message);const targets=new Set(),retired=new Set(),overrides=new Set();
 for(const step of spec.steps){
  keys(step,['targetId','sourceIds','conversion','options','destination','preserveSource'],'Mapeamento');if(!after.some(row=>row.definition.id===step.targetId)||targets.has(step.targetId))throw Error('Destino inexistente ou duplicado no plano.');targets.add(step.targetId);
  if(!Array.isArray(step.sourceIds)||step.sourceIds.length>64||new Set(step.sourceIds).size!==step.sourceIds.length||step.sourceIds.some(id=>!before.some(row=>row.definition.id===id)))throw Error('Fonte inexistente ou duplicada no plano.');
  if(!['block','replace','keep'].includes(step.destination??'block')||step.preserveSource!==undefined&&typeof step.preserveSource!=='boolean')throw Error('Política de preservação/destino inválida.');
  if(step.conversion==='initialize'){keys(step.options,['value'],'Inicialização');if(step.sourceIds.length||!Object.hasOwn(step.options,'value'))throw Error('Inicialização exige valor explícito e nenhuma fonte.');}
  else{validateConversion(step.conversion,step.options);if(!step.sourceIds.length||step.conversion!=='join'&&step.sourceIds.length!==1)throw Error('Quantidade de fontes incompatível com a conversão.');const scopes=step.sourceIds.map(id=>collectionIds(before.find(row=>row.definition.id===id)));if(scopes.some(scope=>!equal(scope,scopes[0])))throw Error('Juntar campos exige fontes na mesma coleção de entrada.');}
 }
 for(const entry of spec.retired??[]){keys(entry,['dataId','disposition'],'Dado descontinuado');if(!before.some(row=>row.definition.id===entry.dataId)||after.some(row=>row.definition.id===entry.dataId)||retired.has(entry.dataId)||!['preserve','remove','recovery'].includes(entry.disposition))throw Error('Escolha de dado descontinuado inválida.');retired.add(entry.dataId);}
 for(const choice of spec.overrides??[]){keys(choice,['characterId','targetId','destination'],'Conflito individual');const key=JSON.stringify([choice.characterId,choice.targetId]);if(!ids.has(choice.characterId)||!targets.has(choice.targetId)||overrides.has(key)||!['replace','keep','block'].includes(choice.destination))throw Error('Escolha de conflito individual inválida.');overrides.add(key);}
 return {targets,retired};
}

// A reviewable plan only. Canonical character writes remain in the existing
// installation transaction and use the common character patch application.
export function planDataMigration({base,candidate,characters,spec={version:1,steps:[],retired:[]}}){
 const original=ready(base,'package'),next=ready(candidate,'package');if(original.system.id!==next.system.id)throw Error('Migração deve preservar a identidade do sistema.');
 if(!Array.isArray(characters)||characters.length>MIGRATION_LIMITS.characters)throw Error('Biblioteca de personagens inválida ou acima do limite.');
 spec=clone(spec);const source=clone(characters),ids=new Set();for(const character of source){if(character?.meta?.id){if(ids.has(character.meta.id))throw Error('Identidade de personagem duplicada.');ids.add(character.meta.id);}}
 if(new TextEncoder().encode(JSON.stringify({base:original,candidate:next,characters:source,spec})).length>MIGRATION_LIMITS.bytes)throw Error('Plano excede o orçamento de32MiB; preserve uma exportação da biblioteca.');
 const before=dataDefinitions(original.system),after=dataDefinitions(next.system),{targets,retired}=validateSpec(spec,before,after,ids),impact=dataMigrationImpact(original,next),missing=impact.filter(row=>row.kind==='changed'?!targets.has(row.dataId):row.kind==='retired'&&!retired.has(row.dataId));
 const result={version:1,systemId:next.system.id,base:original,candidate:next,spec:clone(spec),sourceCharacters:source,impact,characters:[],status:'ready',summary:{characters:source.length,changed:0,values:0,conflicts:0,retired:0},diagnostics:[]};let evaluations=0;
 if(missing.length)result.diagnostics.push(...missing.map(row=>({dataId:row.dataId,message:'Escolha explícita de migração exigida para '+row.label+'.'})));
 const ordered=spec.steps.slice().sort((a,b)=>after.find(row=>row.definition.id===a.targetId).ancestors.length-after.find(row=>row.definition.id===b.targetId).ancestors.length);
 for(const character of source){
  const draft=clone(character),conflicts=[],samples=[],destinations=[],removals=[],relocations=[],id=character?.meta?.id,prepared=prepareDocument(character,{kind:'character',pkg:original});
  if(prepared.status!=='ready')conflicts.push(...prepared.diagnostics.map(issue=>({path:issue.path,message:issue.message,sourceInvalid:true})));
  const report=(dataId,message,path)=>conflicts.push({dataId,message,...(path?{path:path.join('.')}:{})});
  if(!conflicts.length)for(const step of ordered){
   const target=after.find(row=>row.definition.id===step.targetId),sources=step.sourceIds.map(sourceId=>before.find(row=>row.definition.id===sourceId));
   try{
    const scope=step.conversion==='initialize'?contexts(target,next.system,draft):contexts(sources[0],original.system,character);
    for(const context of scope){
     evaluations+=1+sources.length;if(evaluations>MIGRATION_LIMITS.values)throw Error('Limite de cem mil valores de migração excedido.');
     const destinationContext=step.conversion==='initialize'?context:targetContext(target,context),path=pathKeys(dataPath(next.system,draft,target.definition.id,destinationContext)),current=rawCell(draft,path),paths=sources.map(row=>pathKeys(dataPath(original.system,character,row.definition.id,context))),cells=paths.map(path=>rawCell(character,path));
     const own=paths.some(sourcePath=>equal(sourcePath,path))||paths.some(sourcePath=>relocations.some(move=>prefix(move.from,sourcePath)&&equal([...move.to,...sourcePath.slice(move.from.length)],path))),choice=spec.overrides?.find(choice=>choice.characterId===id&&choice.targetId===step.targetId)?.destination??step.destination??'block';
     if(step.conversion==='initialize'&&current.present)continue;
     const cell=step.conversion==='initialize'?{present:true,value:clone(step.options.value)}:convertDataCells(step.conversion,cells,step.options);
     if(!cell.present)continue;
     if(current.present&&!own&&choice==='block'){report(step.targetId,'Destino já preenchido; escolha conservar ou substituir explicitamente.',path);continue;}
     if(current.present&&!own&&choice==='keep')continue;
     putCell(draft,path,cell);destinations.push(path);if(samples.length<MIGRATION_LIMITS.samples)samples.push({dataId:step.targetId,entries:clone(destinationContext.entries),sources:cells,destinationBefore:current,after:clone(cell)});result.summary.values++;
     if(sources.length===1&&['record','collection'].includes(sources[0].definition.type)&&step.conversion==='copy')relocations.push({from:paths[0],to:path});
     if(step.preserveSource===false)removals.push(...paths);
    }
   }catch(error){report(step.targetId,error.message);}
  }
  if(!prepared.diagnostics.some(issue=>issue.severity==='error')){
   for(const entry of spec.retired??[]){const row=before.find(row=>row.definition.id===entry.dataId);try{for(const context of contexts(row,original.system,character)){const path=pathKeys(dataPath(original.system,character,row.definition.id,context));if(entry.disposition==='remove')removals.push(path);result.summary.retired++;}}catch(error){report(entry.dataId,error.message);}}
   const locations=path=>[path,...relocations.filter(move=>prefix(move.from,path)).map(move=>[...move.to,...path.slice(move.from.length)])];
   const cleanup=[...new Map(removals.flatMap(locations).map(path=>[JSON.stringify(path),path])).values()];
   for(const path of cleanup.sort((a,b)=>b.length-a.length)){if(destinations.some(destination=>prefix(path,destination)))continue;try{putCell(draft,path,{present:false});}catch(error){report(null,error.message,path);}}
   for(const entry of spec.retired??[])if(entry.disposition==='preserve'){const row=before.find(row=>row.definition.id===entry.dataId);try{for(const context of contexts(row,original.system,character)){const path=pathKeys(dataPath(original.system,character,row.definition.id,context));if(!locations(path).some(location=>equal(rawCell(character,path),rawCell(draft,location))))report(entry.dataId,'O binding descontinuado mudou; escolha recuperação ou outro destino para preservar o original.',path);}}catch(error){report(entry.dataId,error.message);}}
   if(next.system.schemaVersion===3&&next.system.dataRevision!==undefined){
    if((original.system.schemaVersion!==3||original.system.dataRevision===undefined)&&Object.hasOwn(draft.meta,'systemDataRevision')&&!spec.replaceRevisionMetadata)report(null,'Metadado systemDataRevision já preenchido antes da adoção do contrato; confirme sua preservação na recuperação antes de substituir.');
    else draft.meta.systemDataRevision=systemDataRevision(next.system);
   }
   const validation=prepareDocument(draft,{kind:'character',pkg:next});if(validation.status!=='ready')conflicts.push(...validation.diagnostics.filter(issue=>issue.severity==='error').map(issue=>({path:issue.path,message:issue.message})));
  }
  const patches=changesBetween(character,draft);if(patches.length>10000)report(null,'Personagem excede o limite de dez mil patches do aplicador comum.');if(patches.length||!equal(character?.meta,draft?.meta))result.summary.changed++;
  result.summary.conflicts+=conflicts.length;result.characters.push({id,before:clone(character),after:draft,patches,samples,conflicts});
 }
 if(result.summary.conflicts||result.diagnostics.length)result.status='blocked';return result;
}
