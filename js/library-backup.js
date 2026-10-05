import {validateLibraryBackup} from './validation/backup.js';
import {validateEffectRevisionChange} from './validation/effects.js';
import { allCharacters, characterChanges } from './repositories/character-repository.js';
import { importedPackages, importedSystemsChange, reloadImportedSystems, listSystems, getSystemPackage } from './repositories/system-repository.js';
import { loadSettings, resetSettingsCache } from './storage.js';
import { readJson, transact, recoveryEntries } from './persistence.js';
import { assertValid, validateCharacterForPackage } from './validation/schemas.js';
import { inspectJson, readJsonFile, LIMITS } from './validation/limits.js';

export function exportLibrary(currentCharacter) {
  const characters = allCharacters();
  if (currentCharacter?.meta?.id) {
    const index = characters.findIndex(c => c.meta.id === currentCharacter.meta.id);
    if (index < 0) characters.push(structuredClone(currentCharacter)); else characters[index] = structuredClone(currentCharacter);
  }
  const systems = importedPackages();
  const metadata = readJson('ficha-rpg:v2:library:metadata',{},value=>value && typeof value==='object' && !Array.isArray(value) && !inspectJson(value).length);
  return { ...metadata, schemaVersion: [...systems, ...characters].some(document => document.schemaVersion >= 2) ? 2 : 1, kind: 'rpg-library-backup', exportedAt: new Date().toISOString(), systems, characters, preferences: loadSettings(), recovery: recoveryEntries() };
}

export async function readLibraryBackup(file) {
  const data = await readJsonFile(file, LIMITS.backupBytes, 'backup');
  await validateBackup(data);
  return data;
}

function validateBackup(data) {
  return assertValid(data,value=>validateLibraryBackup(value,{builtinIds:listSystems().filter(s=>s.source==='builtin').map(s=>s.id)}),'backup');
}

export function backupConflicts(data, currentCharacter) {
  const existing = exportLibrary(currentCharacter);
  return { systems: data.systems.filter(pkg => existing.systems.some(old => old.system.id === pkg.system.id)).length, characters: data.characters.filter(c => existing.characters.some(old => old.meta.id === c.meta.id)).length };
}

// O chamador deve obter confirmação explícita antes de replace/overwriteConflicts.
export async function restoreLibrary(data, { mode = 'merge', overwriteConflicts = false, confirmed = false, currentCharacter } = {}) {
  await validateBackup(data);
  if (!['merge', 'replace'].includes(mode)) throw new Error('Modo de restauração inválido.');
  if ((mode === 'replace' || overwriteConflicts) && !confirmed) throw new Error('Confirme a substituição antes de restaurar.');
  const old = exportLibrary(currentCharacter);
  const combine = (original, incoming, id) => {
    const result = new Map(original.map(value => [id(value), value]));
    for (const value of incoming) if (!result.has(id(value)) || overwriteConflicts) result.set(id(value), value);
    return [...result.values()];
  };
  const systems = mode === 'replace' ? data.systems : combine(old.systems, data.systems, p => p.system.id);
  if (mode === 'merge') for (const incoming of data.systems) {
    const existing = old.systems.find(pkg => pkg.system.id === incoming.system.id);
    if (!existing) continue;
    if (overwriteConflicts) assertValid(incoming.system,next=>validateEffectRevisionChange(existing.system,next),'backup.revisão de efeitos');
    else if (data.characters.some(character => character.meta.system === incoming.system.id && !old.characters.some(previous => previous.meta.id === character.meta.id))) {
      // Personagens novos usarão o pacote preservado, que também precisa respeitar
      // o significado da revisão trazida pelo backup.
      assertValid(existing.system,next=>validateEffectRevisionChange(incoming.system,next),'backup.revisão de efeitos');
    }
  }
  const characters = mode === 'replace' ? data.characters : combine(old.characters, data.characters, c => c.meta.id);
  const builtin = new Map(await Promise.all(listSystems().filter(s => s.source === 'builtin').map(async s => [s.id, await getSystemPackage(s.id)])));
  const packages = new Map([...builtin, ...systems.map(p => [p.system.id, p])]);
  for (const character of characters) {
    const pkg = packages.get(character.meta.system);
    if (pkg) assertValid(character, value => validateCharacterForPackage(value, pkg), 'backup.character');
    character.meta.updatedAt ||= new Date().toISOString();
  }
  const preferences = mode === 'replace' || overwriteConflicts ? data.preferences : { ...data.preferences, ...old.preferences };
  const known = new Set(['schemaVersion','kind','exportedAt','systems','characters','preferences','recovery']);
  const incomingMetadata=Object.fromEntries(Object.entries(data).filter(([key])=>!known.has(key)));
  const oldMetadata=Object.fromEntries(Object.entries(old).filter(([key])=>!known.has(key)));
  const metadata=mode==='replace'||overwriteConflicts ? incomingMetadata : {...incomingMetadata,...oldMetadata};
  const changes = [['ficha-rpg:v2:library:metadata',JSON.stringify(metadata)], ...characterChanges(characters, { replace: mode === 'replace' }), importedSystemsChange(systems,{replace:mode==='replace'}), ['ficha-rpg:settings', JSON.stringify(preferences)]];
  for (const entry of data.recovery || []) changes.push([`ficha-rpg:recovery:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(entry)]);
  transact(changes);
  reloadImportedSystems(); resetSettingsCache();
  return { systems: systems.length, characters: characters.length };
}
