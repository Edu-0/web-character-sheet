import { allCharacters, characterChanges } from './repositories/character-repository.js';
import { importedPackages, importedSystemsChange, reloadImportedSystems, listSystems, getSystemPackage } from './repositories/system-repository.js';
import { loadSettings, resetSettingsCache } from './storage.js';
import { transact, recoveryEntries } from './persistence.js';
import { assertValid, validateCharacter, validateSystemPackage, validateCharacterForPackage } from './validation/schemas.js';
import { inspectJson, readJsonFile, LIMITS } from './validation/limits.js';

export function exportLibrary(currentCharacter) {
  const characters = allCharacters();
  if (currentCharacter?.meta?.id) {
    const index = characters.findIndex(c => c.meta.id === currentCharacter.meta.id);
    if (index < 0) characters.push(structuredClone(currentCharacter)); else characters[index] = structuredClone(currentCharacter);
  }
  return { schemaVersion: 1, kind: 'rpg-library-backup', exportedAt: new Date().toISOString(), systems: importedPackages(), characters, preferences: loadSettings(), recovery: recoveryEntries() };
}

export async function readLibraryBackup(file) {
  const data = await readJsonFile(file, LIMITS.backupBytes, 'backup');
  await validateBackup(data);
  return data;
}

async function validateBackup(data) {
  const safety = inspectJson(data, 'backup', {maxNodes: 1000000, maxDepth: LIMITS.depth + 3});
  if (safety.length) throw new Error(`${safety[0].path}: ${safety[0].message}`);
  if (new Blob([JSON.stringify(data)]).size > LIMITS.backupBytes) throw new Error('backup: excede 32 MiB.');
  if (data?.schemaVersion !== 1 || data?.kind !== 'rpg-library-backup') throw new Error('backup.schemaVersion/kind: formato de backup não suportado.');
  if (!Array.isArray(data.systems) || !Array.isArray(data.characters) || !data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) throw new Error('backup: sistemas, personagens ou preferências inválidos.');
  const issues = inspectJson(data.preferences, 'backup.preferences');
  if (issues.length) throw new Error(`${issues[0].path}: ${issues[0].message}`);
  const builtin = new Set(listSystems().filter(s => s.source === 'builtin').map(s => s.id));
  const ids = new Set();
  for (const [i, pkg] of data.systems.entries()) {
    assertValid(pkg, validateSystemPackage, `backup.systems[${i}]`);
    if (new Blob([JSON.stringify(pkg)]).size > LIMITS.systemBytes) throw new Error(`backup.systems[${i}]: excede 4 MiB.`);
    if (builtin.has(pkg.system.id) || ids.has(pkg.system.id)) throw new Error(`backup.systems[${i}].system.id: ID embutido ou duplicado.`);
    ids.add(pkg.system.id);
  }
  ids.clear();
  for (const [i, character] of data.characters.entries()) {
    assertValid(character, validateCharacter, `backup.characters[${i}]`);
    // O backup completo deve preservar retratos legados, sem recomprimir dados já salvos.
    let imageBytes = 0;
    const body = JSON.stringify(character, (key, value) => {
      if (typeof value === 'string' && /^data:image\//i.test(value)) { imageBytes += new Blob([value]).size; return ''; }
      return value;
    });
    if (new Blob([body]).size > LIMITS.characterBytes || imageBytes > LIMITS.systemBytes) throw new Error(`backup.characters[${i}]: excede 2 MiB de dados ou 4 MiB de imagens legadas.`);
    if (ids.has(character.meta.id)) throw new Error(`backup.characters[${i}].meta.id: ID duplicado.`);
    ids.add(character.meta.id);
  }
  if (data.recovery !== undefined && (!Array.isArray(data.recovery) || data.recovery.some(entry => !entry || typeof entry.key !== 'string' || typeof entry.raw !== 'string'))) throw new Error('backup.recovery: dados de recuperação inválidos.');
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
  const characters = mode === 'replace' ? data.characters : combine(old.characters, data.characters, c => c.meta.id);
  const builtin = new Map(await Promise.all(listSystems().filter(s => s.source === 'builtin').map(async s => [s.id, await getSystemPackage(s.id)])));
  const packages = new Map([...builtin, ...systems.map(p => [p.system.id, p])]);
  for (const character of characters) {
    const pkg = packages.get(character.meta.system);
    if (pkg) assertValid(character, value => validateCharacterForPackage(value, pkg), 'backup.character');
    character.meta.updatedAt ||= new Date().toISOString();
  }
  const preferences = mode === 'replace' || overwriteConflicts ? data.preferences : { ...data.preferences, ...old.preferences };
  const changes = [...characterChanges(characters, { replace: mode === 'replace' }), importedSystemsChange(systems), ['ficha-rpg:settings', JSON.stringify(preferences)]];
  for (const entry of data.recovery || []) changes.push([`ficha-rpg:recovery:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(entry)]);
  transact(changes);
  reloadImportedSystems(); resetSettingsCache();
  return { systems: systems.length, characters: characters.length };
}
