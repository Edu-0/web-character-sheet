import {LIMITS} from '../validation/limits.js';
import {validateText} from './validation.js';
import {withLibraryWrite,coordinatedWritesAvailable} from '../write-coordinator.js';
import {readRaw,writeSingleKeyWithinWrite} from '../persistence.js';
export const DRAFT_PREFIX='ficha-rpg:editor:v1:draft:';
export const DRAFT_BYTES=20*1024**2;
const idPattern=/^[a-zA-Z0-9-]{1,100}$/;
const storage=()=>globalThis.localStorage;
function assertEnvelope(value) {
  if(value?.kind!=='rpg-editor-draft' || value.schemaVersion!==1 || !idPattern.test(value.draftId || '') || typeof value.text!=='string' || !Number.isSafeInteger(value.revision) || value.revision<0 || !value.source || typeof value.source!=='object' || !value.ui || typeof value.ui!=='object')throw new Error('Rascunho incompatível ou corrompido. O bruto permanece protegido.');
  if(Array.isArray(value.source) || Array.isArray(value.ui) || typeof value.source.kind!=='string' || value.lastValid && (typeof value.lastValid.text!=='string' || !Number.isSafeInteger(value.lastValid.revision) || value.lastValid.revision<0 || value.lastValid.revision>value.revision))throw new Error('Metadados/última válida do rascunho malformados.');
  return value;
}
export function encodeDraft(envelope) {
  assertEnvelope(envelope);const value=structuredClone(envelope);
  if(value.lastValid){delete value.lastValid.package;if(value.lastValid.text===value.text){delete value.lastValid.text;value.lastValid.sameText=true;}}
  const raw=JSON.stringify(value);if(new TextEncoder().encode(raw).length>DRAFT_BYTES)throw new Error('Rascunho excede 20 MiB; permanece em memória e pode ser baixado.');return raw;
}
export function decodeDraft(raw) {
  if(typeof raw!=='string' || new TextEncoder().encode(raw).length>DRAFT_BYTES)throw new Error('Rascunho excede o limite de recuperação. Preserve o arquivo original.');
  const value=JSON.parse(raw);if(value.lastValid?.sameText)value.lastValid.text=value.text;
  assertEnvelope(value);
  if(value.lastValid){const result=validateText(value.lastValid.text);if(result.status==='ready')value.lastValid.package=result.document;else value.lastValid=null;}
  return value;
}
export function listDrafts() {
  return Object.keys(storage()).filter(key=>key.startsWith(DRAFT_PREFIX)).map(key=>{
    const raw=storage().getItem(key);
    try {const draft=decodeDraft(raw);return {key,raw,draft};}catch(error){return {key,raw,error:error.message};}
  });
}
export function readDraft(id) {if(!idPattern.test(id))throw new Error('ID de rascunho inválido.');return storage().getItem(DRAFT_PREFIX+id);}
async function lock(id,operation) {
  return withLibraryWrite(()=>operation(coordinatedWritesAvailable()));
}
export async function saveDraft(envelope,expectedRaw=null) {
  const raw=encodeDraft(envelope),key=DRAFT_PREFIX+envelope.draftId;
  return lock(envelope.draftId,lock=>{
    const current=readRaw(key);
    if(current!==expectedRaw) {const error=new Error('Este rascunho mudou em outra aba. Salve como cópia para preservar as duas versões.');error.code='draft-conflict';throw error;}
    if(lock===false && current!==null)throw new Error('Coordenação local indisponível. Salve o rascunho como cópia ou baixe-o.');
    writeSingleKeyWithinWrite(key,raw);return raw;
  });
}
export async function deleteDraft(key,expectedRaw) {
  if(!key.startsWith(DRAFT_PREFIX))throw new Error('Chave fora dos rascunhos.');
  return lock(key.slice(DRAFT_PREFIX.length),()=>{if(readRaw(key)!==expectedRaw)throw new Error('Rascunho mudou; revise antes de excluir.');writeSingleKeyWithinWrite(key,null);});
}
