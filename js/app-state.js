// app-state.js
// Estado da aplicação global. Não contém dados completos do personagem nem regras do sistema.

import { getByPath, setByPath, pathKeys } from './engine/paths.js';

const initialState = {
  currentSystem: null,
  currentCharacter: null,
  availableSystems: [],
  availableCharacters: [],
  currentView: 'sheet',
  ui: {
    activeTab: null,
    dndPresentation: 'engine',
  },
};

let appState = structuredClone(initialState);
const listeners = new Set();

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function getPath(path) {
  return getByPath(appState, path);
}

function setPath(path, value) {
  setByPath(appState, path, value);
  notify();
}

function notify() {
  const snapshot = clone(appState);
  listeners.forEach((listener) => listener(snapshot));
}

export function getAppState() {
  return clone(appState);
}

export function setAppState(path, value) {
  setPath(path, clone(value));
}

export function updateAppState(patch) {
  Object.entries(patch).forEach(([key, value]) => {
    pathKeys(key);
    appState[key] = clone(value);
  });
  notify();
}

export function subscribeAppState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetAppState() {
  appState = structuredClone(initialState);
  notify();
}

export { getPath as getAppPath };
