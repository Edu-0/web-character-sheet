import { readJson, readRaw, transact, storageKeys, migrationCopyChange } from '../persistence.js';
import { LIMITS, readJsonFile } from '../validation/limits.js';
import { createId } from '../data.js';
import { assertValid, validateCharacter } from '../validation/schemas.js';
import { prepareDocument } from '../validation/documents.js';
import {hasSystem,getSystemPackage} from './system-repository.js';

const INDEX_KEY = 'ficha-rpg:v2:characters:index';
const CHARACTER_PREFIX = 'ficha-rpg:v2:characters:';

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function readIndex() {
  const index = readJson(INDEX_KEY, [], value => Array.isArray(value) && value.every(entry => entry && typeof entry.id === 'string' && typeof entry.system === 'string' && typeof entry.name === 'string' && Number.isFinite(Date.parse(entry.updatedAt))));
  // Documentos válidos que perderam o índice continuam visíveis e exportáveis.
  const summaries = new Map(index.map(entry => [entry.id, entry]));
  for (const character of allCharacters()) summaries.set(character.meta.id, toSummary(character));
  for (const key of storageKeys().filter(key=>key.startsWith(CHARACTER_PREFIX) && key!==INDEX_KEY)) {
    const id=key.slice(CHARACTER_PREFIX.length);
    if (!getCharacter(id)) {
      let raw; try {raw=JSON.parse(readRaw(key));} catch {raw={};}
      summaries.set(id,{id,system:raw?.meta?.system || 'indisponível',name:typeof raw?.identity?.name==='string'?raw.identity.name:typeof raw?.name==='string'?raw.name:'Documento indisponível',updatedAt:'1970-01-01T00:00:00.000Z',unavailable:true});
    }
  }
  return [...summaries.values()];
}

function displayName(character) {
  return character.identity?.name?.trim() || character.name?.trim() || 'Sem nome';
}

function toSummary(character) {
  return {
    id: character.meta.id,
    system: character.meta.system,
    name: displayName(character),
    updatedAt: character.meta.updatedAt || '1970-01-01T00:00:00.000Z',
  };
}

export function listCharacters() {
  return readIndex().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getCharacter(id) {
  return readJson(`${CHARACTER_PREFIX}${id}`, null, value => validateCharacter(value).length === 0 && value.meta.id === id);
}
export function rawCharacter(id) { return readRaw(`${CHARACTER_PREFIX}${id}`); }

export function allCharacters() {
  return storageKeys().filter(key => key.startsWith(CHARACTER_PREFIX) && key !== INDEX_KEY).map(key => getCharacter(key.slice(CHARACTER_PREFIX.length))).filter(Boolean);
}

export function characterChanges(characters, { replace = false } = {}) {
  const changes = [];
  if (replace) for (const key of storageKeys().filter(key => key.startsWith(CHARACTER_PREFIX) && key !== INDEX_KEY)) changes.push([key, null]);
  for (const character of characters) changes.push([`${CHARACTER_PREFIX}${character.meta.id}`, JSON.stringify(character)]);
  changes.push([INDEX_KEY, JSON.stringify(characters.map(toSummary))]);
  return [...new Map(changes)];
}

export function saveCharacter(character, {copies = []} = {}) {
  const stored = clone(character);
  stored.meta ||= {};
  stored.meta.updatedAt = new Date().toISOString();
  assertValid(stored, validateCharacter, 'personagem');
  const index = readIndex().filter((entry) => entry.id !== stored.meta.id);
  index.push(toSummary(stored));
  transact([[`${CHARACTER_PREFIX}${stored.meta.id}`, JSON.stringify(stored)], [INDEX_KEY, JSON.stringify(index)], ...copies]);
  return stored;
}

export function createCharacter(system) {
  if (!system.characterTemplate) throw new Error(`O sistema "${system.name}" não possui characterTemplate.`);
  const character = clone(system.characterTemplate);
  const now = new Date().toISOString();
  character.meta = {
    ...character.meta,
    id: createId(),
    system: system.id,
    createdAt: now,
    updatedAt: now,
  };
  return saveCharacter(character);
}

export function duplicateCharacter(id) {
  const source = getCharacter(id);
  if (!source) throw new Error('Personagem não encontrado.');
  source.meta.id = createId();
  source.meta.createdAt = new Date().toISOString();
  if (source.identity?.name) source.identity.name = `${source.identity.name} (cópia)`;
  else if (source.name) source.name = `${source.name} (cópia)`;
  return saveCharacter(source);
}

export function removeCharacter(id) {
  transact([[`${CHARACTER_PREFIX}${id}`, null], [INDEX_KEY, JSON.stringify(readIndex().filter(entry => entry.id !== id))]]);
}

export async function importCharacter(file, { validate, confirmMigration } = {}) {
  let character = await readJsonFile(file, LIMITS.characterBytes, 'character'), migrationPlan;
  const pkg = hasSystem(character?.meta?.system) ? await getSystemPackage(character.meta.system) : undefined;
  const prepared=prepareDocument(character,{kind:'character',pkg,allowMissingId:true,normalize:Boolean(confirmMigration)});
  assertValid(character,()=>prepared.diagnostics,'personagem');
  if(confirmMigration) {
    if(prepared.status==='needsMigration') {
      if(!await confirmMigration(prepared.migrationPlan)) throw new Error('Importação cancelada; o original foi preservado.');
      migrationPlan=prepared.migrationPlan;character=prepared.document;
    }
  }
  character = prepared.document;
  assertValid(character, (value) => validateCharacter(value, { allowMissingId: true }), 'personagem');
  character.meta.id = createId();
  character.meta.createdAt ||= new Date().toISOString();
  await validate?.(character);
  return saveCharacter(character,{copies:migrationPlan?[migrationCopyChange(`import:${file.name}`,migrationPlan.original)]:[]});
}

export function exportCharacter(character) {
  const safeName = displayName(character).replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'personagem';
  return { filename: `${safeName}.json`, data: clone(character) };
}
