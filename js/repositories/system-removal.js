import {readJson, readRaw, storageKeys, transactWithinWrite} from '../persistence.js';
import {withLibraryWrite, verifyWriterClients} from '../write-coordinator.js';
import {listSystems, reloadImportedSystems} from './system-repository.js';
import {listCharacters} from './character-repository.js';
import {CATALOG_KEY, catalogInstallationIds, catalogInstallationsChange} from './catalog-installations.js';
import {resetSettingsCache} from '../storage.js';

const SYSTEMS='ficha-rpg:v2:systems', INDEX='ficha-rpg:v2:characters:index';
const PREFIX='ficha-rpg:v2:characters:', SETTINGS='ficha-rpg:settings';
const SESSION='ficha-rpg:v2:app-session', LEGACY='ficha-rpg:character';
function snapshot() {
  return JSON.stringify(storageKeys().filter(key=>[SYSTEMS, CATALOG_KEY, SETTINGS, SESSION, LEGACY].includes(key)||key.startsWith(PREFIX)).sort().map(key=>[key,readRaw(key)]));
}
function readCollection() {
  const value=readJson(SYSTEMS,[],Array.isArray);
  const raw=readRaw(SYSTEMS);
  if(raw!==null){try{if(!Array.isArray(JSON.parse(raw)))throw new Error();}catch{throw new Error('A coleção de sistemas está inválida. Preserve a recuperação antes de excluir.');}}
  return value;
}
function prepare(id) {
  reloadImportedSystems();
  const system=listSystems().find(entry=>entry.id===id);
  if(!system)throw new Error('O sistema não está instalado. Atualize a biblioteca.');
  const all=readCollection();
  if(system.source==='unavailable' && !all.some(pkg=>pkg?.system?.id===id))throw new Error('Não é possível identificar este pacote. Exporte a recuperação antes de excluir.');
  const summaries=listCharacters();
  if(summaries.some(character=>character.unavailable && character.system==='indisponível'))throw new Error('Há personagem indisponível sem identificação de sistema. Preserve/corrija o original antes de excluir sistemas.');
  const rawIndex=readRaw(INDEX);
  let index=[];
  if(rawIndex!==null){try{index=JSON.parse(rawIndex);if(!Array.isArray(index)||index.some(entry=>!entry || typeof entry.id!=='string' || typeof entry.system!=='string'))throw new Error();}catch{throw new Error('O índice de personagens está inválido. Preserve a recuperação antes de excluir.');}}
  return {system,characters:summaries.filter(character=>character.system===id),snapshot:snapshot()};
}
export function prepareSystemRemoval(id) {return withLibraryWrite(()=>prepare(id));}

// A confirmação deve mostrar os personagens do plano. Mudanças posteriores
// invalidam a operação inteira, antes de tocar em qualquer chave.
export async function removeSystem(plan) {
  await verifyWriterClients();
  return withLibraryWrite(()=>{
    if(snapshot()!==plan.snapshot)throw new Error('A biblioteca mudou durante a confirmação. Revise a lista de personagens e confirme novamente.');
    const fresh=prepare(plan.system.id), id=fresh.system.id;
    const linked=new Set(fresh.characters.map(character=>character.id));
    const changes=[];
    if(fresh.system.source==='builtin')changes.push(catalogInstallationsChange(catalogInstallationIds().filter(value=>value!==id)));
    if(readCollection().some(pkg=>pkg?.system?.id===id))changes.push([SYSTEMS,JSON.stringify(readCollection().filter(pkg=>pkg?.system?.id!==id))]);
    for(const characterId of linked)changes.push([PREFIX+characterId,null]);
    const index=readJson(INDEX,[],Array.isArray);
    changes.push([INDEX,JSON.stringify(index.filter(entry=>!linked.has(entry.id) && entry.system!==id))]);
    const preferences=readJson(SETTINGS,{},value=>value && typeof value==='object' && !Array.isArray(value));
    if(Array.isArray(preferences.layoutSelections)){
      preferences.layoutSelections=preferences.layoutSelections.filter(entry=>entry.systemId!==id);
      changes.push([SETTINGS,JSON.stringify(preferences)]);
    }
    const session=readJson(SESSION,{},value=>value && typeof value==='object' && !Array.isArray(value));
    if(session.currentSystemId===id || linked.has(session.currentCharacterId))changes.push([SESSION,JSON.stringify({...session,currentSystemId:null,currentCharacterId:null,currentView:'systems'})]);
    const legacy=readJson(LEGACY,null);
    if(legacy && (legacy.meta?.system || 'dnd2024')===id)changes.push([LEGACY,null]);
    transactWithinWrite(changes,{confirmedDeletionKeys:[...linked].map(characterId=>PREFIX+characterId)});
    reloadImportedSystems();resetSettingsCache();
    return {id,deletedCharacters:linked.size};
  });
}
