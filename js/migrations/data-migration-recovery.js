import {prepareDocument} from '../validation/documents.js';
import {inspectJson,LIMITS} from '../validation/limits.js';
import {changesBetween} from '../engine/character-history.js';
const clone=value=>structuredClone(value),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function ready(document,kind,pkg){const result=prepareDocument(document,{kind,pkg});if(result.status!=='ready')throw Error(result.diagnostics.map(issue=>issue.message).join('; '));return result.document;}
export function validateMigrationRecovery(record){
 if(!object(record)||record.kind!=='rpg-data-migration'||record.schemaVersion!==1||typeof record.id!=='string'||!record.id||typeof record.systemId!=='string'||Object.keys(record).some(key=>!['kind','schemaVersion','id','systemId','spec','beforePackage','beforeCharacters','beforeRawCharacters','afterPackage','afterCharacters','restorationOf'].includes(key)))throw Error('Cópia de migração incompatível ou corrompida.');
 const checked=clone(record),issues=inspectJson(checked,'migrationRecovery',{maxString:LIMITS.backupBytes,maxNodes:1000000,maxDepth:LIMITS.depth+3});if(issues.length||new TextEncoder().encode(JSON.stringify(checked)).length>LIMITS.backupBytes)throw Error('Cópia de migração excede os limites de recuperação.');
 const before=ready(checked.beforePackage,'package'),after=ready(checked.afterPackage,'package');if(before.system.id!==checked.systemId||after.system.id!==checked.systemId)throw Error('Identidade do sistema diverge da recuperação.');
 const ids=new Set();if(!Array.isArray(checked.beforeCharacters)||checked.beforeCharacters.length>10000)throw Error('Personagens originais indisponíveis.');
 for(const character of checked.beforeCharacters){ready(character,'character',before);if(ids.has(character.meta.id))throw Error('Personagem duplicado na recuperação.');ids.add(character.meta.id);}
 const validateList=(rows,label,requireDocument)=>{
  if(!Array.isArray(rows)||rows.length!==ids.size||new Set(rows.map(row=>row?.id)).size!==ids.size)throw Error(label+': identidades incompletas ou duplicadas.');
  for(const row of rows){if(!object(row)||!ids.has(row.id)||Object.keys(row).some(key=>!['id','raw'].includes(key))||!(typeof row.raw==='string'||!requireDocument&&row.raw===null))throw Error(label+': valor bruto inválido.');if(requireDocument){let document;try{document=JSON.parse(row.raw);}catch{throw Error(label+': JSON inválido.');}ready(document,'character',after);if(document.meta.id!==row.id)throw Error(label+': identidade divergente.');}}
 };
 validateList(checked.beforeRawCharacters,'Originais brutos',false);validateList(checked.afterCharacters,'Guardas de restauração',true);return checked;
}
// Reversing a reviewed snapshot produces patches for the same installer. It
// never resurrects a deleted/changed character or restores over later edits.
export function planDataRestoration({record,currentPackage,characters}){
 const recovery=validateMigrationRecovery(record),diagnostics=[],plans=[],ids=new Set(characters.map(character=>character.meta.id)),expected=new Set(recovery.afterCharacters.map(row=>row.id));
 if(!equal(currentPackage,recovery.afterPackage))diagnostics.push({message:'O pacote mudou desde a migração. Exporte os originais; restauração automática bloqueada.'});
 if(ids.size!==characters.length||ids.size!==expected.size||[...ids].some(id=>!expected.has(id)))diagnostics.push({message:'A biblioteca vinculada mudou desde a migração. Restauração conjunta bloqueada.'});
 for(const current of characters){
  const guard=recovery.afterCharacters.find(row=>row.id===current.meta.id),original=recovery.beforeCharacters.find(character=>character.meta.id===current.meta.id),conflicts=[];
  if(!guard||JSON.stringify(current)!==guard.raw)conflicts.push({message:'Personagem alterado depois da migração; exporte o original para comparar sem substituir sua edição.'});
  if(original)plans.push({id:current.meta.id,before:clone(current),after:clone(original),patches:changesBetween(current,original),conflicts,samples:[]});else diagnostics.push({message:'Personagem novo sem original nesta cópia.'});
 }
 return {version:1,status:diagnostics.length||plans.some(row=>row.conflicts.length)?'blocked':'ready',record:recovery,characters:plans,diagnostics,summary:{characters:characters.length,changed:plans.length,conflicts:diagnostics.length+plans.reduce((sum,row)=>sum+row.conflicts.length,0)}};
}
