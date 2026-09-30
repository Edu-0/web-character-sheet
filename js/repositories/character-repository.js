import { createId } from '../data.js';
import { assertValid, validateCharacter } from '../validation/schemas.js';

const INDEX_KEY = 'ficha-rpg:v2:characters:index';
const CHARACTER_PREFIX = 'ficha-rpg:v2:characters:';

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function readIndex() {
  try {
    const value = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function displayName(character) {
  return character.identity?.name?.trim() || character.name?.trim() || 'Sem nome';
}

function toSummary(character) {
  return {
    id: character.meta.id,
    system: character.meta.system,
    name: displayName(character),
    updatedAt: character.meta.updatedAt,
  };
}

export function listCharacters() {
  return readIndex().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getCharacter(id) {
  try {
    const raw = localStorage.getItem(`${CHARACTER_PREFIX}${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCharacter(character) {
  const stored = clone(character);
  stored.meta ||= {};
  stored.meta.updatedAt = new Date().toISOString();
  assertValid(stored, validateCharacter, 'personagem');
  localStorage.setItem(`${CHARACTER_PREFIX}${stored.meta.id}`, JSON.stringify(stored));
  const index = readIndex().filter((entry) => entry.id !== stored.meta.id);
  index.push(toSummary(stored));
  writeIndex(index);
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
  localStorage.removeItem(`${CHARACTER_PREFIX}${id}`);
  writeIndex(readIndex().filter((entry) => entry.id !== id));
}

export async function importCharacter(file) {
  let character;
  try {
    character = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo do personagem não contém JSON válido.');
  }
  assertValid(character, (value) => validateCharacter(value, { allowMissingId: true }), 'personagem');
  character.meta.id = createId();
  character.meta.createdAt ||= new Date().toISOString();
  return saveCharacter(character);
}

export function exportCharacter(character) {
  const safeName = displayName(character).replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'personagem';
  return { filename: `${safeName}.json`, data: clone(character) };
}
