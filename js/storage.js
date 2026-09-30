// storage.js
// Toda a persistência (localStorage, import/export JSON, imagens) fica isolada aqui.
const CHARACTER_KEY = 'ficha-rpg:character';
const SETTINGS_KEY = 'ficha-rpg:settings';
const APP_SESSION_KEY = 'ficha-rpg:v2:app-session';

let saveTimeout = null;

export function saveCharacter(character) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(CHARACTER_KEY, JSON.stringify(character));
    } catch (err) {
      console.error('Falha ao salvar personagem:', err);
    }
  }, 300);
}

export function loadCharacter() {
  try {
    const raw = localStorage.getItem(CHARACTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Falha ao carregar personagem:', err);
    return null;
  }
}

export function clearCharacter() {
  localStorage.removeItem(CHARACTER_KEY);
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Falha ao salvar configurações:', err);
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

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

export function importCharacterFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        resolve(data);
      } catch (err) {
        reject(new Error('Arquivo JSON inválido.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsText(file);
  });
}

export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function saveAppSession(session) {
  localStorage.setItem(APP_SESSION_KEY, JSON.stringify(session));
}

export function loadAppSession() {
  try {
    return JSON.parse(localStorage.getItem(APP_SESSION_KEY) || '{}');
  } catch {
    return {};
  }
}

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
