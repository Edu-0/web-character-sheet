import { readJson, tryWriteJson, transact } from './persistence.js';
import { inspectJson, readJsonFile, LIMITS } from './validation/limits.js';
import { compressPortrait } from './images.js';
// storage.js
// Toda a persistência (localStorage, import/export JSON, imagens) fica isolada aqui.
const CHARACTER_KEY = 'ficha-rpg:character';
const SETTINGS_KEY = 'ficha-rpg:settings';
const APP_SESSION_KEY = 'ficha-rpg:v2:app-session';

let saveTimeout = null;

export function saveCharacter(character) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => tryWriteJson(CHARACTER_KEY, character), 300);
}

export function loadCharacter() { return readJson(CHARACTER_KEY, null); }
export function clearCharacter() { transact([[CHARACTER_KEY, null]]); }
let memorySettings;
function validObject(value) { return value && typeof value === 'object' && !Array.isArray(value) && !inspectJson(value).length; }
export function saveSettings(settings) {
  memorySettings = structuredClone(settings);
  return tryWriteJson(SETTINGS_KEY, settings);
}
export function loadSettings() {
  return structuredClone(memorySettings ?? readJson(SETTINGS_KEY, {}, validObject));
}
export function resetSettingsCache() { memorySettings = undefined; }

export function exportCharacterToFile(character) {
  const name = (character.identity?.name || 'personagem').trim().replace(/\s+/g, '_') || 'personagem';
  const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importCharacterFromFile(file) { return readJsonFile(file, LIMITS.characterBytes, 'character'); }
export const readImageAsDataUrl = compressPortrait;
export function saveAppSession(session) { return tryWriteJson(APP_SESSION_KEY, session); }
export function loadAppSession() { return readJson(APP_SESSION_KEY, {}, validObject); }

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
