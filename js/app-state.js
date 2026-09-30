// app-state.js
// Estado da aplicação global. Não contém dados completos do personagem nem regras do sistema.

const initialState = {
  currentSystem: null,
  currentCharacter: null,
  availableSystems: [],
  availableCharacters: [],
  currentView: 'sheet',
  ui: {
    activeTab: null,
  },
};

let appState = structuredClone(initialState);
const listeners = new Set();

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function getPath(path) {
  return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), appState);
}

function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((obj, key) => {
    if (obj[key] == null || typeof obj[key] !== 'object') obj[key] = {};
    return obj[key];
  }, appState);
  target[last] = value;
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
