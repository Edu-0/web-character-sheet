import {inspectJson,LIMITS} from './limits.js';
import {versionIssue} from './versions.js';
import {validateSystemPackage,validateCharacter} from './schemas.js';

export function validateLibraryBackup(data,{builtinIds=[]}={}) {
  const issues=inspectJson(data,'backup',{maxNodes:1000000,maxDepth:LIMITS.depth+3});if(issues.length) return issues;
  const add=(path,message)=>issues.push({path,message,code:'backup.invalid'});
  const version=versionIssue(data,'backup');if(version) issues.push(version);
  if(data?.kind!=='rpg-library-backup') add('backup.kind','formato de backup não suportado');
  if(new Blob([JSON.stringify(data)]).size>LIMITS.backupBytes) add('backup','excede 32 MiB');
  if(!Array.isArray(data?.systems)||!Array.isArray(data?.characters)||!data?.preferences||typeof data.preferences!=='object'||Array.isArray(data.preferences)) {add('backup','sistemas, personagens ou preferências inválidos');return issues;}
  if(data.schemaVersion<2 && [...data.systems,...data.characters].some(doc=>doc?.schemaVersion>=2)) add('backup.schemaVersion','conteúdo versão 2 exige envelope versão 2');
  const ids=new Set();
  data.systems.forEach((pkg,i)=>{
    const root=`backup.systems[${i}]`;
    issues.push(...validateSystemPackage(pkg).map(issue=>({...issue,path:issue.path.replace(/^package(?=\.|$)/,root).replace(/^system(?=\.|$)/,`${root}.system`)})));
    if(new Blob([JSON.stringify(pkg)]).size>LIMITS.systemBytes) add(root,'excede 4 MiB');
    if(builtinIds.includes(pkg?.system?.id)||ids.has(pkg?.system?.id)) add(`${root}.system.id`,'ID embutido ou duplicado');ids.add(pkg?.system?.id);
  });
  ids.clear();
  data.characters.forEach((character,i)=>{
    const root=`backup.characters[${i}]`;
    issues.push(...validateCharacter(character).map(issue=>({...issue,path:issue.path.replace(/^character(?=\.|$)/,root)})));
    let imageBytes=0;
    const body=JSON.stringify(character,(_key,value)=>{if(typeof value==='string'&&/^data:image\//i.test(value)){imageBytes+=new Blob([value]).size;return '';}return value;});
    if(new Blob([body]).size>LIMITS.characterBytes || imageBytes>LIMITS.systemBytes) add(root,'excede 2 MiB de dados ou 4 MiB de imagens legadas');
    if(ids.has(character?.meta?.id)) add(`${root}.meta.id`,'ID duplicado');ids.add(character?.meta?.id);
  });
  if(data.recovery!==undefined&&(!Array.isArray(data.recovery)||data.recovery.some(entry=>!entry||typeof entry.key!=='string'||typeof entry.raw!=='string'))) add('backup.recovery','dados de recuperação inválidos');
  return issues;
}
