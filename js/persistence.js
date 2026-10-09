// Adaptador local comum. Journal contém o estado anterior e permite rollback após interrupção.
import {withLibraryWrite,inLibraryWrite,registerLibraryStorage} from './write-coordinator.js';
const JOURNAL = 'ficha-rpg:v2:storage-journal';
const recovery = new Map();
const protectedKeys = new Set();
const unsupportedKeys = new Set();
let recovering = false;
let writeValues;
const libraryKey=key=>key.startsWith('ficha-rpg:');
registerLibraryStorage({
  live:()=>Object.keys(localStorage).filter(libraryKey).map(key=>[key,localStorage.getItem(key)]),
  adopt:values=>{writeValues=new Map(values);},snapshot:()=>[...(writeValues || new Map())],
});
function setRawWithinWrite(key,value){value==null?localStorage.removeItem(key):localStorage.setItem(key,value);if(value==null)writeValues?.delete(key);else writeValues?.set(key,value);}
export function writeSingleKeyWithinWrite(key,value){if(!inLibraryWrite() || !key.startsWith('ficha-rpg:editor:'))throw new Error('Escrita de rascunho fora do coordenador.');setRawWithinWrite(key,value);}

export function reportStorageError(error, message = 'Não foi possível salvar. Suas alterações continuam em memória; exporte um backup antes de sair.') {
  globalThis.dispatchEvent?.(new CustomEvent('storage:problem', { detail: { message, error: error?.name } }));
}

export function readRaw(key) {
  try { return inLibraryWrite() && writeValues && libraryKey(key) ? writeValues.get(key) ?? null : localStorage.getItem(key); }
  catch (error) { reportStorageError(error, 'Não foi possível ler os dados locais. Evite substituir a biblioteca; tente recuperar o acesso ao armazenamento.'); throw error; }
}

export function preserveRaw(key, raw, reason = 'JSON inválido') {
  if(recovery.get(key)?.raw===raw && !protectedKeys.has(key))return;
  const entry = { key, raw, reason, recoveredAt: new Date().toISOString() };
  recovery.set(key, entry);
  const recoveryKey = `ficha-rpg:recovery:${Date.now()}:${crypto.randomUUID()}`;
  protectedKeys.add(key);
  const copy=()=>{try {setRawWithinWrite(recoveryKey,JSON.stringify(entry));protectedKeys.delete(key);}catch{protectedKeys.add(key);}};
  if(inLibraryWrite())copy();else withLibraryWrite(copy).catch(()=>{});
  reportStorageError(null, 'Dados locais inválidos foram preservados para recuperação. Use Exportar recuperação nas configurações.');
}

export function readJson(key, fallback, validate = () => true) {
  const raw = readRaw(key);
  if (raw == null) return structuredClone(fallback);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.schemaVersion === 'number' && parsed.schemaVersion > 1) {
      // O validador da família decide se essa versão já é suportada.
      if (!validate(parsed)) { unsupportedKeys.add(key); throw new Error('versão de documento não suportada'); }
    }
    if (!validate(parsed)) throw new Error('estrutura inválida');
    unsupportedKeys.delete(key);
    return parsed;
  } catch (error) {
    if (!recovery.has(key) || recovery.get(key).raw !== raw) preserveRaw(key, raw, error.message);
    return structuredClone(fallback);
  }
}

export function recoverTransactions() {return withLibraryWrite(recoverTransactionsWithinWrite);}
function recoverTransactionsWithinWrite() {
  if (recovering) return;
  recovering = true;
  try {
    const raw = readRaw(JOURNAL);
    if (!raw) return;
    let journal;
    try { journal = JSON.parse(raw); }
    catch (error) { preserveRaw(JOURNAL, raw, error.message); throw error; }
    if (!Array.isArray(journal.before) || journal.before.some(e => !Array.isArray(e) || typeof e[0] !== 'string' || !e[0].startsWith('ficha-rpg:') || e[0] === JOURNAL || e[1] !== null && typeof e[1] !== 'string')) {
      preserveRaw(JOURNAL, raw); throw new Error('Journal inválido: restauração automática bloqueada.');
    }
    for (const [key, value] of [...journal.before].reverse()) if (readRaw(key) !== value) setRawWithinWrite(key,value);
    setRawWithinWrite(JOURNAL,null);
  } catch (error) { reportStorageError(error, 'Uma gravação interrompida precisa de recuperação. A biblioteca não será sobrescrita.'); throw error; }
  finally { recovering = false; }
}

export function transact(changes) {return withLibraryWrite(()=>transactWithinWrite(changes));}
export function transactWithinWrite(changes, {confirmedDeletionKeys = []} = {}) {
  if(!inLibraryWrite())throw new Error('Gravação exige o coordenador comum.');
  recoverTransactionsWithinWrite();
  const next = new Map(changes);
  const before = [...next.keys()].map(key => [key, readRaw(key)]).filter(([key, value]) => next.get(key) !== value);
  if (!before.length) return;
  for (const [key] of before) if (unsupportedKeys.has(key) && !(next.get(key)===null && confirmedDeletionKeys.includes(key))) throw new Error('Versão não suportada: o documento original está protegido contra gravação. Exporte a recuperação.');
  for (const [key] of before) if (protectedKeys.has(key)) {
    const entry = recovery.get(key);
    if (entry) preserveRaw(key, entry.raw, entry.reason);
    if (protectedKeys.has(key)) throw new Error('O conteúdo original não pôde ser copiado. Exporte a recuperação e libere espaço antes de substituir dados.');
  }
  try {
    setRawWithinWrite(JOURNAL, JSON.stringify({schemaVersion: 1, before}));
    for (const [key] of before) setRawWithinWrite(key,next.get(key));
    setRawWithinWrite(JOURNAL,null);
  } catch (error) {
    try { recoverTransactionsWithinWrite(); } catch { /* Journal fica disponível para próxima tentativa/recuperação. */ }
    reportStorageError(error);
    throw new Error('Falha ao gravar a biblioteca. As alterações não foram confirmadas; exporte seus dados antes de sair.', { cause: error });
  }
  try { warnStoragePressure(); } catch { /* o write já foi confirmado; leitura indisponível já foi sinalizada */ }
}

export function writeJson(key, value) { return transact([[key, JSON.stringify(value)]]); }
export async function tryWriteJson(key, value) { try { await writeJson(key, value); return true; } catch { return false; } }
export function storageKeys() { try { return inLibraryWrite() && writeValues ? [...writeValues.keys(),...Object.keys(localStorage).filter(key=>!libraryKey(key))] : Object.keys(localStorage); } catch (error) { reportStorageError(error); throw error; } }
export function recoveryEntries() {
  const all = new Map([...recovery.values()].map(entry => [`${entry.key}:${entry.recoveredAt}`, entry]));
  for (const key of storageKeys().filter(key => key.startsWith('ficha-rpg:recovery:'))) {
    try { const entry = JSON.parse(readRaw(key)); all.set(`${entry.key}:${entry.recoveredAt}`, entry); } catch { /* preservado bruto no storage */ }
  }
  return [...all.values()];
}

// Uma cópia de transformação faz parte da mesma transação; não depende do journal após sucesso.
export function migrationCopyChange(label, original) {
  return [`ficha-rpg:recovery:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify({key:label,raw:JSON.stringify(original),reason:'Original anterior à migração confirmada',recoveredAt:new Date().toISOString()})];
}
let warned = false;
function warnStoragePressure() {
  const bytes = storageKeys().filter(key => key.startsWith('ficha-rpg:')).reduce((sum,key) => sum + (key.length + (readRaw(key)?.length || 0)) * 2, 0);
  if (bytes > 4 * 1024 ** 2 && !warned) {
    warned = true;
    reportStorageError(null, 'Sua biblioteca está ficando grande. Exporte um backup; o espaço disponível varia conforme o navegador.');
  }
}
