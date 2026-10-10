import {parseSource} from './source-map.js';
import {valueAt,object,safeKey} from './form-structure.js';
import {knownReferences} from './references.js';
import {pointerFor} from './source-map.js';
export function setValueCommands(pkg,path,value,remove=false) {
  const owner=valueAt(pkg,path.slice(0,-1)),key=path.at(-1);
  if(Array.isArray(owner)){if(!Number.isInteger(key) || key<0 || key>=owner.length)throw new Error('Entrada ausente.');return [{type:'removeNode',path:path.slice(0,-1),index:key},...(!remove?[{type:'insertNode',path:path.slice(0,-1),index:key,value}]:[])];}
  return [{type:remove?'removeProperty':'setProperty',path,...(!remove?{value}:{}),precondition:{exists:object(owner)&&Object.hasOwn(owner,key),...(object(owner)&&Object.hasOwn(owner,key)?{value:owner[key]}:{})}}];
}
export function renameKeyCommands(pkg,path,newKey) {
  safeKey(newKey);const owner=valueAt(pkg,path.slice(0,-1)),oldKey=path.at(-1);
  if(!object(owner) || !Object.hasOwn(owner,oldKey))throw new Error('Alvo ausente.');
  if(newKey===oldKey)return [];
  if(Object.hasOwn(owner,newKey))throw new Error('A chave já existe.');
  return [{type:'setProperty',path:[...path.slice(0,-1),newKey],value:owner[oldKey]},...setValueCommands(pkg,path,null,true)];
}
export function referenceOptions(pkg,path,key) {
  const paths=(root,prefix='',depth=0)=>{if(depth>10 || !object(root)&&!Array.isArray(root))return [];return Object.entries(root).flatMap(([name,value])=>{const next=prefix?prefix+'.'+name:name;return [next,...paths(value,next,depth+1)];});};
  if(key==='formula')return Object.keys(pkg.system?.formulas || {});
  if(['rollPreset','rollConfigFrom'].includes(key))return Object.keys(pkg.system?.entryRolls || {});
  if(key==='check')return Object.keys(pkg.system?.checks || {});
  if(key==='sourceId'){const owner=valueAt(pkg,path.slice(0,-1));return (pkg.system?.checks?.[owner?.check]?.sources || []).map(source=>source.id).filter(Boolean);}
  const systemPaths=paths(pkg.system),fields=paths(pkg.system?.characterTemplate);
  if(key==='optionsFrom' && path.includes('itemSchema'))return [...fields.map(field=>'character.'+field),...systemPaths.map(field=>'system.'+field)];
  if(key==='system'||key.endsWith('From')||key==='source'&&path.includes('repeat'))return systemPaths;
  return fields;
}
export function knownUsages(pkg,path) {
  const value=valueAt(pkg,path),name=path.at(-1),parent=path.at(-2),id=object(value)?value.id:typeof value==='string'?value:undefined;
  const systemKinds=new Set(['configFrom','actionsFrom','presetsFrom','traitsFrom','costsFrom','labelsFrom','catalogFrom','progressionFrom','formulaFrom','attributesFrom','categoriesFrom','baseDieFrom','sidesFrom']);
  return knownReferences(pkg).filter(entry=>entry.pointer!==pointerFor(path) && (
    parent==='formulas'?entry.kind==='formula'&&entry.value===name:
    parent==='checks'?['check','checkTarget'].includes(entry.kind)&&entry.value===name || entry.kind==='configFrom'&&entry.value==='checks.'+name:
    parent==='entryRolls'?['rollPreset','rollConfigFrom'].includes(entry.kind)&&entry.value===name:
    path.includes('effectDefinitions')&&id?entry.kind==='definitionId'&&entry.value===id:
    path[1]==='checks' && path.includes('sources') && id?entry.kind==='sourceId'&&entry.value===id&&valueAt(pkg,pointerPath(pkg,entry.pointer).slice(0,-1))?.check===path[2]:
    parent==='variables'?entry.kind==='expression'&&entry.value.includes(name):
    typeof value==='string'&&path.at(-1)==='id'&&path.length===2?entry.kind==='system'&&entry.value===value:
    path[0]==='system' && path[1]!=='characterTemplate' && (systemKinds.has(entry.kind) || entry.kind==='source' && entry.pointer.includes('/repeat/') || entry.kind==='system' && entry.pointer.includes('/variables/') || entry.kind==='optionsFrom' && !entry.value.startsWith('character.'))?
      [path.slice(1).join('.'),'system.'+path.slice(1).join('.')].some(prefix=>entry.value===prefix || entry.value.startsWith(prefix+'.') || entry.value.startsWith(prefix+'[]')):false));
}

export const pointerPath=(pkg,pointer)=>{const path=[];for(const raw of pointer.split('/').slice(1)){const key=raw.replaceAll('~1','/').replaceAll('~0','~');path.push(Array.isArray(valueAt(pkg,path))?Number(key):key);}return path;};
export function renameDefinitionPlan(pkg,path,newKey) {
  if(path.includes('itemSchema'))throw new Error('Renomear campo de item exige revisar dados e referências. Use o JSON; os registros dos personagens não são migrados.');
  const commands=renameKeyCommands(pkg,path,newKey),oldKey=path.at(-1),family=path.at(-2),usages=path[1]==='characterTemplate'?removalImpact(pkg,path).incoming:knownUsages(pkg,path);
  if(!commands.length)return {commands,usages,notes:[]};
  if(path.length===3 && ['formulas','checks','entryRolls'].includes(family)){
    for(const usage of usages){const refPath=pointerPath(pkg,usage.pointer),value=usage.kind==='configFrom'?'checks.'+newKey:newKey;commands.push(...setValueCommands(pkg,refPath,value));
      if(family==='formulas'){const owner=valueAt(pkg,refPath.slice(0,-1));if(owner && !Object.hasOwn(owner,'overrideKey') && (owner.type==='computed' && owner.mode!=='roll' || refPath.includes('checks') && refPath.includes('sources')))commands.push(...setValueCommands(pkg,[...refPath.slice(0,-1),'overrideKey'],oldKey));}
    }
    return {commands,usages,notes:family==='formulas'?['Chaves automáticas dos cálculos são preservadas com overrideKey. Expressões e extensões opacas não são reescritas.']:['Referências conhecidas serão atualizadas juntas. Extensões opacas não são reescritas.']};
  }
  if(usages.length)throw new Error('Esta chave tem usos sem refatoração segura. Ajuste referências explicitamente no JSON antes de renomear.');
  return {commands,usages,notes:['Referências opacas e fórmulas não são refatoradas por substituição de texto.']};
}
export function identityPlan(pkg,path,newId) {
  safeKey(newId);const old=valueAt(pkg,path),commands=setValueCommands(pkg,path,newId),usages=[];
  if(path.length===2 && path[0]==='system' && path[1]==='id'){
    if(pkg.system.characterTemplate?.meta?.system===old)commands.push(...setValueCommands(pkg,['system','characterTemplate','meta','system'],newId));
    pkg.layouts?.forEach((layout,index)=>{if(layout.system===old)commands.push(...setValueCommands(pkg,['layouts',index,'system'],newId));});
    return {commands,usages:knownUsages(pkg,path),notes:['Trocar system.id cria outro pacote ao aplicar; personagens instalados não são migrados. Somente os vínculos de identidade declarados mudam.']};
  }
  if(path.at(-1)==='id' && path.includes('sources') && path[1]==='checks'){
    const checkId=path[2],array=valueAt(pkg,path.slice(0,-2));if(array?.some(item=>item?.id===newId && item!==valueAt(pkg,path.slice(0,-1))))throw new Error('ID de fonte já existe.');
    for(const ref of knownReferences(pkg))if(ref.kind==='sourceId' && ref.value===old){const refPath=pointerPath(pkg,ref.pointer),owner=valueAt(pkg,refPath.slice(0,-1));if(owner?.check===checkId){usages.push(ref);commands.push(...setValueCommands(pkg,refPath,newId));}}
  }
  if(path.at(-1)==='id' && path.includes('effectDefinitions'))for(const ref of knownReferences(pkg))if(ref.kind==='definitionId'&&ref.value===old){usages.push(ref);commands.push(...setValueCommands(pkg,pointerPath(pkg,ref.pointer),newId));}
  return {commands,usages,notes:['Dados de personagens instalados e extensões opacas permanecem intactos. A aplicação fará o preflight existente.']};
}
export function removalImpact(pkg,path) {
  const target=valueAt(pkg,path),prefix=pointerFor(path)+'/',incoming=knownUsages(pkg,path),outgoing=knownReferences(pkg).filter(entry=>entry.pointer.startsWith(prefix));
  if(path[0]==='system'&&path[1]==='characterTemplate'){
    const field=path.slice(2).join('.');for(const entry of knownReferences(pkg))if(entry.value===field || typeof entry.value==='string'&&entry.value.startsWith(field+'.') || entry.kind==='expression'&&typeof entry.value==='string'&&entry.value.includes(field))if(!entry.pointer.startsWith(prefix))incoming.push(entry);
  }
  return {incoming,outgoing,notes:['Campos e registros dos personagens instalados não são apagados. Expressões são relatadas como unidades; extensões opacas não entram no relatório.']};
}

export function numberFromText(raw,{integer=false}={}) {
  const parsed=parseSource(raw.trim());if(typeof parsed.value!=='number' || parsed.diagnostics.length || integer && !Number.isSafeInteger(parsed.value))throw new Error('Informe um número representável'+(integer?' inteiro':'')+'. O texto pendente permanece salvo.');return parsed.value;
}
